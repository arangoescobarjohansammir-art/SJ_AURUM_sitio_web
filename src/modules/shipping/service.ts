import { queueOrderMail } from "../mail/outbox";
import { randomUUID } from "node:crypto";
import { adminTransaction } from "../admin/service";
import { CommerceError } from "../commerce/service";
import { rateSchema, shipmentSchema, normalizeDestination } from "./validation";
import { shippingSelection } from "./selection";
export async function listRates(token: string | undefined) {
  return adminTransaction(token, (tx) =>
    tx.shippingRate.findMany({
      where: { demo: true },
      orderBy: [{ department: "asc" }, { city: "asc" }],
      take: 500,
    }),
  );
}
export async function saveRate(token: string | undefined, input: unknown) {
  return adminTransaction(token, async (tx, actorId) => {
    const { id, expectedVersion, reason, ...data } = rateSchema.parse(input);
    const before = id
      ? await tx.shippingRate.findFirst({ where: { id, demo: true } })
      : null;
    if (id && (!before || before.version !== expectedVersion))
      throw new CommerceError(
        "EDIT_CONFLICT",
        "La tarifa cambió. Recarga antes de guardar.",
      );
    const rates = await tx.shippingRate.findMany({ where: { demo: true } });
    if (
      rates.some(
        (r) =>
          r.id !== id &&
          normalizeDestination(r.city) === normalizeDestination(data.city) &&
          normalizeDestination(r.department) ===
            normalizeDestination(data.department),
      )
    )
      throw new CommerceError(
        "DUPLICATE_DESTINATION",
        "Ya existe una tarifa para ese destino.",
      );
    if (!id && rates.length >= 500)
      throw new CommerceError(
        "RATE_LIMIT",
        "Límite de 500 destinos de prueba.",
      );
    const rate = id
      ? await tx.shippingRate.update({
          where: { id },
          data: { ...data, version: { increment: 1 } },
        })
      : await tx.shippingRate.create({
          data: { ...data, id: randomUUID(), demo: true },
        });
    await tx.adminAudit.create({
      data: {
        actorId,
        action: "SHIPPING_RATE",
        entityId: rate.id,
        before: before ?? {},
        after: rate,
        reason,
      },
    });
    return rate;
  });
}
const transitions: Record<string, string[]> = {
  PENDING: ["PREPARING"],
  PREPARING: ["PREPARING", "SHIPPED", "ISSUE"],
  SHIPPED: ["SHIPPED", "DELIVERED", "ISSUE", "RETURNED"],
  ISSUE: ["ISSUE", "PREPARING", "SHIPPED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  RETURNED: [],
};
export async function updateShipment(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  return adminTransaction(token, async (tx, actorId) => {
    const data = shipmentSchema.parse(input);
    const order = await tx.order.findFirst({
      where: { id, demo: true },
      include: { payment: { include: { refund: true } } },
    });
    if (!order)
      throw new CommerceError("NOT_FOUND", "Pedido no encontrado.", 404);
    const envia = await tx.enviaShipment.findUnique({ where: { orderId: id } });
    if (envia && ["GENERATING", "UNKNOWN"].includes(envia.state))
      throw new CommerceError(
        "ENVIA_PENDING",
        "Revisa primero la solicitud pendiente en Envia Sandbox.",
      );
    if (
      envia?.state === "CREATED" &&
      (data.carrier !== envia.carrier ||
        data.trackingNumber !== envia.trackingNumber)
    )
      throw new CommerceError(
        "ENVIA_GUIDE",
        "Conserva la transportadora y la guía creadas por Envia.",
      );
    if (order.version !== data.expectedVersion)
      throw new CommerceError(
        "EDIT_CONFLICT",
        "El pedido cambió. Recarga antes de guardar.",
      );
    if (
      order.status !== "PAID" ||
      order.payment?.status !== "APPROVED" ||
      order.payment.refund
    )
      throw new CommerceError(
        "SHIPPING_BLOCKED",
        "Solo se preparan pedidos con pago aprobado y sin solicitud de reembolso.",
      );
    if (!transitions[order.shippingStatus]?.includes(data.status))
      throw new CommerceError(
        "INVALID_TRANSITION",
        "Ese cambio de seguimiento no está permitido.",
      );
    if ((await tx.shippingEvent.count({ where: { orderId: id } })) >= 100)
      throw new CommerceError(
        "EVENT_LIMIT",
        "Límite de 100 eventos de prueba por pedido.",
      );
    const event = await tx.shippingEvent.create({
      data: { orderId: id, status: data.status, note: data.note },
    });
    const result = await tx.order.update({
      where: { id },
      data: {
        shippingStatus: data.status,
        shippingCarrier: data.carrier,
        trackingNumber: data.trackingNumber,
        version: { increment: 1 },
      },
      select: { version: true, ...shippingSelection },
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        action: "SHIPMENT_UPDATE",
        entityId: id,
        before: {
          status: order.shippingStatus,
          carrier: order.shippingCarrier,
          trackingNumber: order.trackingNumber,
        },
        after: {
          status: data.status,
          carrier: data.carrier,
          trackingNumber: data.trackingNumber,
        },
        reason: data.note,
      },
    });
    await queueOrderMail(
      tx,
      id,
      "shipment:" + event.id,
      "Actualización del envío de prueba",
    );
    return result;
  });
}
