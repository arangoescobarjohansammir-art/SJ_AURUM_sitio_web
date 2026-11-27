import { orderStates } from "../admin/orders-validation";
import { shippingStates } from "../shipping/validation";
import type { Prisma } from "../../generated/prisma/client";
import { getDb } from "../../lib/db";
import { mailOrigin, sender, sendMail, MailError } from "./transport";
import { template } from "./templates";
export async function queueOrderMail(
  tx: Prisma.TransactionClient,
  orderId: string,
  eventKey: string,
  title: string,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  const to = (order.recipient as { email?: string }).email;
  if (!to) return;
  let origin = "";
  try {
    origin = mailOrigin();
  } catch {
    /* Keep business events even if mail configuration is invalid. */
  }
  const content = template(
    title,
    [
      "Pedido " + order.number,
      "Estado: " + orderStates[order.status],
      "Envío: " +
        (shippingStates[order.shippingStatus as keyof typeof shippingStates] ??
          order.shippingStatus),
      ...(order.trackingNumber ? ["Guía: " + order.trackingNumber] : []),
      "Esta es una notificación de prueba de SJ AURUM. Consulta el estado actualizado de tu pedido en la tienda.",
    ],
    origin ? origin + "/pedidos" : "",
    "Consultar pedido",
  );
  await tx.mailOutbox.upsert({
    where: { eventKey },
    create: {
      eventKey,
      orderId,
      mode: process.env.MAIL_PROVIDER ?? "local",
      ...(!origin ? { status: "FAILED", lastError: "MAIL_LINK_ORIGIN" } : {}),
      sender: sender(),
      recipient: to,
      ...content,
    },
    update: {},
  });
}
export async function processMailBatch() {
  const db = getDb();
  const rows = await db.mailOutbox.findMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      nextAttemptAt: { lte: new Date() },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let sent = 0,
    failed = 0;
  for (const row of rows) {
    const claim = await db.mailOutbox.updateMany({
      where: {
        id: row.id,
        attempts: row.attempts,
        status: { in: ["PENDING", "PROCESSING"] },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date() } }],
      },
      data: {
        status: "PROCESSING",
        lockedUntil: new Date(Date.now() + 60000),
        firstAttemptAt: row.firstAttemptAt ?? new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    if (
      row.attempts >= 5 ||
      (row.firstAttemptAt &&
        Date.now() - row.firstAttemptAt.getTime() > 23 * 3600000)
    ) {
      await db.mailOutbox.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          lastError: "MAIL_RETRY_LIMIT",
          lockedUntil: null,
        },
      });
      failed++;
      continue;
    }
    try {
      const result = await sendMail(
        {
          to: row.recipient,
          from: row.sender,
          subject: row.subject,
          text: row.text,
          html: row.html,
        },
        "order:" + row.id,
        row.mode,
      );
      await db.mailOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          providerId: result.id,
          sentAt: new Date(),
          lockedUntil: null,
          lastError: null,
        },
      });
      sent++;
    } catch (e) {
      const code = e instanceof MailError ? e.code : "MAIL_DELIVERY_ERROR";
      const retry =
        [
          "MAIL_NETWORK",
          "MAIL_RESPONSE",
          "MAIL_HTTP_429",
          "MAIL_HTTP_409",
        ].includes(code) || /^MAIL_HTTP_5/.test(code);
      await db.mailOutbox.update({
        where: { id: row.id },
        data: {
          status: retry && row.attempts < 4 ? "PENDING" : "FAILED",
          lastError: code,
          lockedUntil: null,
          nextAttemptAt: new Date(
            Date.now() + Math.min(3600000, 60000 * 2 ** row.attempts),
          ),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
