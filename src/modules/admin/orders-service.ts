import { adminTransaction } from "./service";
import { CommerceError, release } from "../commerce/service";
import { orderFilters, orderChange } from "./orders-validation";
import type { Prisma } from "../../generated/prisma/client";
const summary = {
  id: true,
  number: true,
  status: true,
  followUp: true,
  version: true,
  total: true,
  createdAt: true,
  expiresAt: true,
  shippingLabel: true,
} as const;
const missing = () =>
  new CommerceError("NOT_FOUND", "No encontramos ese pedido de ejemplo.", 404);
async function expire(tx: Prisma.TransactionClient, id: string) {
  const order = await tx.order.findFirst({
    where: { id, demo: true },
    select: { status: true, expiresAt: true },
  });
  if (!order) throw missing();
  if (order.status === "RESERVED" && order.expiresAt <= new Date())
    await release(tx, id, "EXPIRED");
}
export async function listAdminOrders(
  token: string | undefined,
  input: unknown,
) {
  return adminTransaction(token, async (tx) => {
    const f = orderFilters.parse(input);
    // Process all due demonstration reservations so filters and counts are truthful.
    const due = await tx.order.findMany({
      where: { demo: true, status: "RESERVED", expiresAt: { lte: new Date() } },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const row of due) await release(tx, row.id, "EXPIRED");
    const where: Prisma.OrderWhereInput = {
      demo: true,
      ...(f.status ? { status: f.status } : {}),
      ...(f.followUp ? { followUp: f.followUp } : {}),
      ...(f.query
        ? {
            OR: [
              { number: { contains: f.query, mode: "insensitive" } },
              {
                recipient: {
                  path: ["name"],
                  string_contains: f.query,
                  mode: "insensitive",
                },
              },
              {
                recipient: {
                  path: ["email"],
                  string_contains: f.query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const total = await tx.order.count({ where }),
      pages = Math.max(1, Math.ceil(total / 20)),
      page = Math.min(f.page, pages);
    const orders = await tx.order.findMany({
      where,
      select: summary,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      skip: (page - 1) * 20,
    });
    return { orders, total, pages, page };
  });
}
export async function adminOrderDetail(token: string | undefined, id: string) {
  return adminTransaction(token, async (tx) => {
    await expire(tx, id);
    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      select: {
        ...summary,
        subtotal: true,
        discount: true,
        shipping: true,
        couponCode: true,
        recipient: true,
        items: {
          select: {
            productName: true,
            variantLabel: true,
            sku: true,
            unitPrice: true,
            quantity: true,
          },
        },
        movements: {
          select: {
            id: true,
            kind: true,
            quantity: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const history = await tx.adminAudit.findMany({
      where: {
        entityId: id,
        action: { in: ["ORDER_FOLLOW_UP", "ORDER_CANCEL"] },
      },
      select: {
        id: true,
        action: true,
        before: true,
        after: true,
        reason: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return { order, history };
  });
}
export async function changeAdminOrder(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  return adminTransaction(token, async (tx, actorId) => {
    const data = orderChange.parse(input);
    const order = await tx.order.findFirst({ where: { id, demo: true } });
    if (!order) throw missing();
    if (order.version !== data.expectedVersion)
      throw new CommerceError(
        "EDIT_CONFLICT",
        "El pedido cambió. Recarga antes de guardar.",
        409,
      );
    const before = { status: order.status, followUp: order.followUp };
    if (data.action === "CANCEL") {
      if (order.status !== "RESERVED" || order.expiresAt <= new Date())
        throw new CommerceError(
          "ORDER_CLOSED",
          "La reserva ya terminó. Recarga el pedido.",
          409,
        );
      await release(
        tx,
        id,
        "CANCELLED",
        undefined,
        "Cancelación administrativa: " + data.reason,
      );
    } else {
      await tx.order.update({
        where: { id },
        data: { followUp: data.followUp, version: { increment: 1 } },
      });
    }
    const updated = await tx.order.findUniqueOrThrow({
      where: { id },
      select: summary,
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        entityId: id,
        action: data.action === "CANCEL" ? "ORDER_CANCEL" : "ORDER_FOLLOW_UP",
        before,
        after: { status: updated.status, followUp: updated.followUp },
        reason: data.reason,
      },
    });
    return updated;
  });
}
