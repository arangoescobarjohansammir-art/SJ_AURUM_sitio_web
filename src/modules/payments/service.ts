import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../lib/db";
import { toPaymentCents } from "../../lib/money";
import { transaction, CommerceError, release } from "../commerce/service";
import { adminTransaction } from "../admin/service";
import {
  checkoutUrl,
  checkoutWidget,
  fetchTransaction,
  paymentConfig,
  verifyEvent,
  wompiRequest,
  type WompiTransaction,
} from "./wompi";

export const paymentSelection = {
  status: true,
  transactionId: true,
  checkedAt: true,
  refund: { select: { status: true } },
} as const;
export async function startPayment(sessionId: string, orderId: string) {
  paymentConfig();
  return transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, sessionId, demo: true },
      include: { payment: true },
    });
    if (!order)
      throw new CommerceError("NOT_FOUND", "Pedido no encontrado.", 404);
    if (
      order.status !== "RESERVED" ||
      order.expiresAt <= new Date() ||
      (order.payment && order.payment.status !== "CREATED")
    )
      throw new CommerceError(
        "PAYMENT_CLOSED",
        "Este pedido ya no admite iniciar un pago. Consulta su estado.",
      );
    const payment =
      order.payment ??
      (await tx.payment.create({
        data: { orderId, reference: "AURUM-" + randomUUID() },
      }));
    return {
      url: checkoutUrl(payment.reference, order.total, order.expiresAt),
      widget: checkoutWidget(payment.reference, order.total, order.expiresAt),
    };
  });
}

// Only call with a transaction fetched from Wompi, never directly with webhook/return parameters.
export async function applyTransaction(
  data: WompiTransaction,
  sessionId?: string,
) {
  return transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { reference: data.reference },
      include: {
        order: { include: { items: { orderBy: { variantId: "asc" } } } },
        refund: true,
      },
    });
    if (!payment || (sessionId && payment.order.sessionId !== sessionId))
      throw new CommerceError("NOT_FOUND", "Pago no encontrado.", 404);
    const order = payment.order;
    if (
      !order.demo ||
      data.currency !== "COP" ||
      data.amount_in_cents !== toPaymentCents(order.total) ||
      (payment.transactionId && payment.transactionId !== data.id)
    )
      throw new CommerceError(
        "PAYMENT_MISMATCH",
        "La transacción no coincide con el pedido.",
      );
    // Do not regress a final state when concurrent provider queries complete out of order.
    const terminal = ["APPROVED", "DECLINED", "ERROR", "VOIDED"].includes(
      payment.status,
    );
    if (
      terminal &&
      data.status !== payment.status &&
      !(payment.status === "APPROVED" && data.status === "VOIDED")
    )
      return { orderId: order.id, status: payment.status };
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        transactionId: data.id,
        status: data.status,
        checkedAt: new Date(),
      },
    });
    if (data.status === "APPROVED" && payment.status !== "APPROVED") {
      if (order.status === "RESERVED" && order.expiresAt > new Date()) {
        for (const item of order.items) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: {
              stock: { decrement: item.quantity },
              reserved: { decrement: item.quantity },
            },
          });
          await tx.inventoryMovement.create({
            data: {
              variantId: item.variantId,
              orderId: order.id,
              kind: "SALE",
              quantity: -item.quantity,
              reason: "Pago aprobado en Wompi Sandbox; venta ficticia",
            },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID", version: { increment: 1 } },
        });
      } else {
        if (order.status === "RESERVED") await release(tx, order.id, "EXPIRED");
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAYMENT_REVIEW",
            followUp: "ISSUE",
            version: { increment: 1 },
          },
        });
      }
    }
    if (
      ["DECLINED", "ERROR", "VOIDED"].includes(data.status) &&
      order.status === "RESERVED"
    )
      await release(
        tx,
        order.id,
        "CANCELLED",
        undefined,
        "Pago Wompi Sandbox: " + data.status,
      );
    if (
      data.status === "VOIDED" &&
      ["PAID", "PAYMENT_REVIEW"].includes(order.status)
    )
      await tx.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED", version: { increment: 1 } },
      });
    return { orderId: order.id, status: data.status };
  });
}
export async function syncPayment(sessionId: string, id: string) {
  return applyTransaction(await fetchTransaction(id), sessionId);
}
export async function receiveEvent(input: unknown) {
  const id = verifyEvent(input);
  const data = await fetchTransaction(id);
  // Ignore other checkouts/datáfono links on the same merchant account.
  if (
    !(await getDb().payment.findUnique({
      where: { reference: data.reference },
      select: { id: true },
    }))
  )
    return { ignored: true };
  return applyTransaction(data);
}
export async function refundPayment(
  token: string | undefined,
  orderId: string,
  input: unknown,
) {
  paymentConfig();
  const reason = z
    .object({ reason: z.string().trim().min(8).max(500) })
    .parse(input).reason;
  const prepared = await adminTransaction(token, async (tx, actorId) => {
    const payment = await tx.payment.findUnique({
      where: { orderId },
      include: { order: true, refund: true },
    });
    if (
      !payment ||
      !payment.order.demo ||
      payment.status !== "APPROVED" ||
      !payment.transactionId ||
      !["PAID", "PAYMENT_REVIEW"].includes(payment.order.status)
    )
      throw new CommerceError(
        "NOT_REFUNDABLE",
        "Este pedido no admite un reembolso.",
      );
    if (payment.refund)
      throw new CommerceError(
        "REFUND_EXISTS",
        "Ya existe una solicitud. Revisa su estado en Wompi; no se enviará otra.",
      );
    const refund = await tx.paymentRefund.create({
      data: { paymentId: payment.id, reason },
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        action: "PAYMENT_REFUND",
        entityId: orderId,
        before: {
          status: payment.order.status,
          followUp: payment.order.followUp,
        },
        after: {
          status: payment.order.status,
          followUp: payment.order.followUp,
          refundId: refund.id,
        },
        reason,
      },
    });
    return {
      refund,
      transactionId: payment.transactionId,
      amount: toPaymentCents(payment.order.total),
    };
  });
  // Durable claim precedes the external POST. Unknown outcomes must not be automatically retried.
  let result;
  try {
    result = z
      .object({
        data: z.object({
          id: z.union([z.string(), z.number()]),
          status: z.enum([
            "APPROVED",
            "PENDING",
            "DECLINED",
            "ERROR",
            "CANCELLED",
          ]),
          amount_in_cents: z.number(),
          transaction_id: z.string(),
        }),
      })
      .parse(
        await wompiRequest("refunds", {
          transaction_id: prepared.transactionId,
          amount_in_cents: prepared.amount,
          reason,
          reference: prepared.refund.id,
        }),
      ).data;
    if (
      result.amount_in_cents !== prepared.amount ||
      result.transaction_id !== prepared.transactionId
    )
      throw Error("Refund mismatch");
  } catch {
    await getDb().paymentRefund.update({
      where: { id: prepared.refund.id },
      data: { status: "UNKNOWN" },
    });
    throw new CommerceError(
      "REFUND_UNKNOWN",
      "Resultado de reembolso sin confirmar. Revisa Wompi antes de cualquier nueva solicitud.",
      503,
    );
  }
  await transaction(async (tx) => {
    await tx.paymentRefund.update({
      where: { id: prepared.refund.id },
      data: { status: result.status, providerId: String(result.id) },
    });
    if (result.status === "APPROVED")
      await tx.order.update({
        where: { id: orderId },
        data: { status: "REFUNDED", version: { increment: 1 } },
      });
  });
  return { status: result.status };
}
