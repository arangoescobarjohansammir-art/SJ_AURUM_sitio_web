import { queueOrderMail } from "../mail/outbox";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../lib/db";
import type { Prisma } from "../../generated/prisma/client";
import { adminTransaction } from "../admin/service";
import { CommerceError, transaction } from "../commerce/service";
import { recipientSchema } from "../commerce/validation";
import { enviaQuoteSchema, enviaRateSchema } from "./envia-validation";
import {
  enviaConfig,
  enviaRequest,
  parseLabel,
  parseRates,
  safeLabelUrl,
} from "./envia";
export const enviaSelection = {
  state: true,
  quoteKey: true,
  rates: true,
  expiresAt: true,
  trackingNumber: true,
  labelUrl: true,
  carrier: true,
  service: true,
  providerStatus: true,
  checkedAt: true,
} as const;
async function eligible(
  tx: Prisma.TransactionClient,
  id: string,
  version?: number,
) {
  const order = await tx.order.findFirst({
    where: { id, demo: true },
    include: { payment: { include: { refund: true } }, enviaShipment: true },
  });
  if (!order)
    throw new CommerceError("NOT_FOUND", "Pedido no encontrado.", 404);
  if (version !== undefined && order.version !== version)
    throw new CommerceError(
      "EDIT_CONFLICT",
      "El pedido cambió. Recarga antes de continuar.",
    );
  if (
    order.status !== "PAID" ||
    order.payment?.status !== "APPROVED" ||
    order.payment.refund
  )
    throw new CommerceError(
      "SHIPPING_BLOCKED",
      "Se requiere pago aprobado sin reembolso solicitado.",
    );
  return order;
}
export async function enviaStatus(token: string | undefined, id: string) {
  return adminTransaction(token, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, demo: true },
      select: { id: true },
    });
    if (!order)
      throw new CommerceError("NOT_FOUND", "Pedido no encontrado.", 404);
    let configured = false;
    try {
      enviaConfig();
      configured = true;
    } catch {}
    return {
      configured,
      shipment: await tx.enviaShipment.findUnique({
        where: { orderId: id },
        select: enviaSelection,
      }),
    };
  });
}
export async function quoteEnvia(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  const data = enviaQuoteSchema.parse(input);
  enviaConfig();
  const prepared = await adminTransaction(token, async (tx) => {
    const order = await eligible(tx, id, data.expectedVersion);
    if (order.enviaShipment && order.enviaShipment.state !== "QUOTED")
      throw new CommerceError(
        "ENVIA_EXISTS",
        "Ya existe una solicitud de guía; revisa su estado.",
      );
    if (
      !["PENDING", "PREPARING"].includes(order.shippingStatus) ||
      order.trackingNumber
    )
      throw new CommerceError(
        "SHIPPING_STARTED",
        "Este pedido ya tiene seguimiento de despacho.",
      );
    const r = recipientSchema.parse(order.recipient);
    return {
      version: order.version,
      payload: {
        origin: { ...data.origin, country: "CO" },
        destination: {
          ...data.destination,
          country: "CO",
          name: r.name,
          phone: r.phone,
          street: r.address,
          email: r.email,
          reference: r.additional,
        },
        packages: [
          {
            type: "box",
            content: "Accesorios de bisutería de prueba",
            amount: 1,
            declaredValue: order.subtotal - order.discount,
            lengthUnit: "CM",
            weightUnit: "KG",
            weight: data.weight,
            dimensions: {
              length: data.length,
              width: data.width,
              height: data.height,
            },
          },
        ],
        settings: { currency: "COP" },
        shipment: { type: 1, carrier: data.carrier },
      },
    };
  });
  const rates = parseRates(await enviaRequest("/ship/rate/", prepared.payload));
  return adminTransaction(token, async (tx, actorId) => {
    await eligible(tx, id, prepared.version);
    const existing = await tx.enviaShipment.findUnique({
      where: { orderId: id },
    });
    if (existing && existing.state !== "QUOTED")
      throw new CommerceError("ENVIA_EXISTS", "Ya se solicitó una guía.");
    const values = {
      payload: prepared.payload,
      rates,
      quoteKey: randomUUID(),
      orderVersion: prepared.version,
      expiresAt: new Date(Date.now() + 10 * 60000),
    };
    const result = await tx.enviaShipment.upsert({
      where: { orderId: id },
      create: { orderId: id, ...values },
      update: values,
      select: enviaSelection,
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        entityId: id,
        action: "ENVIA_QUOTE",
        before: {},
        after: { quoteKey: result.quoteKey, services: rates.length },
        reason: "Cotización Envia Sandbox",
      },
    });
    return result;
  });
}
export async function generateEnvia(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  const data = z
    .object({
      quoteKey: z.uuid(),
      rateIndex: z.number().int().min(0).max(99),
      acceptedSandbox: z.literal(true),
    })
    .parse(input);
  enviaConfig();
  const claimed = await adminTransaction(token, async (tx, actorId) => {
    const order = await eligible(tx, id);
    const row = order.enviaShipment;
    if (!row || row.quoteKey !== data.quoteKey)
      throw new CommerceError("QUOTE_CHANGED", "Vuelve a cotizar el envío.");
    if (row.state !== "QUOTED")
      throw new CommerceError(
        "ENVIA_EXISTS",
        "La guía ya fue solicitada. No se repetirá; consulta Envia Sandbox.",
      );
    if (row.expiresAt <= new Date() || row.orderVersion !== order.version)
      throw new CommerceError(
        "QUOTE_CHANGED",
        "La cotización venció o el pedido cambió.",
      );
    const rate = z.array(enviaRateSchema).parse(row.rates)[data.rateIndex];
    if (!rate)
      throw new CommerceError("INVALID_RATE", "Selecciona una tarifa vigente.");
    const payload = row.payload as Prisma.JsonObject;
    await tx.enviaShipment.update({
      where: { orderId: id },
      data: {
        state: "GENERATING",
        carrier: rate.carrier,
        service: rate.service,
      },
    });
    await tx.order.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        entityId: id,
        action: "ENVIA_GENERATE",
        before: { state: "QUOTED" },
        after: {
          state: "GENERATING",
          carrier: rate.carrier,
          service: rate.service,
          totalPrice: rate.totalPrice,
        },
        reason: "Solicitud única de guía Sandbox",
      },
    });
    return {
      actorId,
      rate,
      payload: {
        ...payload,
        settings: {
          currency: "COP",
          printFormat: "PDF",
          printSize: "PAPER_4X6",
          comments: "SJ AURUM prueba " + id,
        },
        shipment: { type: 1, carrier: rate.carrier, service: rate.service },
      },
    };
  });
  try {
    const label = parseLabel(
      await enviaRequest("/ship/generate/", claimed.payload),
    );
    if (
      label.carrier !== claimed.rate.carrier ||
      label.service !== claimed.rate.service
    )
      throw Error("Shipment mismatch");
    return await transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { payment: { include: { refund: true } } },
      });
      const changed = await tx.enviaShipment.updateMany({
        where: { orderId: id, state: "GENERATING" },
        data: {
          state: "CREATED",
          trackingNumber: label.trackingNumber,
          labelUrl: safeLabelUrl(label.label),
          providerStatus: "Created",
        },
      });
      if (changed.count !== 1) throw Error("Shipment state changed");
      await tx.order.update({
        where: { id },
        data: {
          trackingNumber: label.trackingNumber,
          shippingCarrier: label.carrier,
          shippingStatus: "PREPARING",
          version: { increment: 1 },
          ...(order.status !== "PAID" || order.payment?.refund
            ? { followUp: "ISSUE" }
            : {}),
        },
      });
      await tx.shippingEvent.create({
        data: {
          orderId: id,
          status: "PREPARING",
          note: "Guía de prueba creada en Envia Sandbox; pendiente de recogida.",
        },
      });
      await tx.adminAudit.create({
        data: {
          actorId: claimed.actorId,
          entityId: id,
          action: "ENVIA_CREATED",
          before: { state: "GENERATING" },
          after: { state: "CREATED", trackingNumber: label.trackingNumber },
          reason: "Respuesta confirmada de Envia Sandbox",
        },
      });
      await queueOrderMail(
        tx,
        id,
        "envia:" + id + ":created",
        "Guía de prueba creada",
      );
      return tx.enviaShipment.findUniqueOrThrow({
        where: { orderId: id },
        select: enviaSelection,
      });
    });
  } catch {
    await getDb().enviaShipment.updateMany({
      where: { orderId: id, state: "GENERATING" },
      data: { state: "UNKNOWN" },
    });
    throw new CommerceError(
      "ENVIA_UNKNOWN",
      "No pudimos confirmar la guía. Revisa Envia Sandbox; no se enviará otra solicitud para evitar duplicados.",
      502,
    );
  }
}
export async function trackEnvia(token: string | undefined, id: string) {
  const row = await adminTransaction(token, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, demo: true },
      include: { enviaShipment: true },
    });
    if (!order?.enviaShipment || order.enviaShipment.state !== "CREATED")
      throw new CommerceError(
        "ENVIA_NOT_CREATED",
        "No hay una guía confirmada de Envia.",
      );
    return order.enviaShipment;
  });
  const result = await enviaRequest("/ship/generaltrack/", {
    trackingNumbers: [row.trackingNumber],
  });
  const rows = z
    .object({
      data: z
        .array(
          z.object({
            trackingNumber: z.string(),
            status: z.string().min(1).max(100),
          }),
        )
        .max(100),
    })
    .parse(result).data;
  const item = rows.find((r) => r.trackingNumber === row.trackingNumber);
  if (!item)
    throw new CommerceError(
      "ENVIA_NO_TRACKING",
      "Envia todavía no devuelve seguimiento para esta guía.",
    );
  return adminTransaction(token, async (tx, actorId) => {
    const updated = await tx.enviaShipment.update({
      where: { orderId: id },
      data: { providerStatus: item.status, checkedAt: new Date() },
      select: enviaSelection,
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        entityId: id,
        action: "ENVIA_TRACK",
        before: { providerStatus: row.providerStatus },
        after: { providerStatus: item.status },
        reason: "Consulta de seguimiento Envia Sandbox",
      },
    });
    return updated;
  });
}
