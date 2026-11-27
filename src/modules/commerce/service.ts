import { createHash, randomUUID } from "node:crypto";
import { getDb } from "../../lib/db";
import type { Prisma } from "../../generated/prisma/client";
import {
  cartChangeSchema,
  checkoutSchema,
  orderSchema,
  type CheckoutInput,
  type OrderInput,
} from "./validation";

type Tx = Prisma.TransactionClient;
export class CommerceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getDb().$transaction(run, {
        isolationLevel: "Serializable",
        timeout: 15000,
      });
    } catch (error) {
      const failure = error as {
        code?: string;
        meta?: { driverAdapterError?: { cause?: { originalCode?: string } } };
      };
      const sqlState = failure.meta?.driverAdapterError?.cause?.originalCode;
      if (
        attempt < 4 &&
        (failure.code === "P2034" ||
          (failure.code === "P2010" &&
            (sqlState === "40001" || sqlState === "40P01")))
      )
        continue;
      throw error;
    }
  }
}

async function lockSession(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "VisitorSession" WHERE "id"=${id} AND "expiresAt">NOW() FOR UPDATE`;
  if (!rows.length)
    throw new CommerceError(
      "SESSION_EXPIRED",
      "Tu sesión venció. Recarga la página.",
      401,
    );
}

export async function catalog() {
  const records = await getDb().product.findMany({
    where: { active: true, demo: true },
    include: { variants: { where: { active: true }, orderBy: { id: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return records
    .filter((p) => p.variants.length)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      image: p.image,
      gallery: p.gallery,
      demo: p.demo,
      variants: p.variants.map((v) => ({
        id: v.id,
        label: v.label,
        price: v.price,
        stock: v.stock - v.reserved,
      })),
    }));
}

export async function getCart(sessionId: string, tx: Tx = getDb()) {
  const items = await tx.cartItem.findMany({
    where: { sessionId },
    include: { variant: { include: { product: true } } },
    orderBy: { variantId: "asc" },
  });
  return items.map(({ quantity, variant: v }) => ({
    variantId: v.id,
    quantity,
    name: v.product.name,
    slug: v.product.slug,
    label: v.label,
    image: v.product.image,
    unitPrice: v.price,
    stock: v.stock - v.reserved,
    available: v.active && v.product.active && v.product.demo,
  }));
}

export async function setCartQuantity(sessionId: string, input: unknown) {
  const { variantId, quantity } = cartChangeSchema.parse(input);
  return transaction(async (tx) => {
    await lockSession(tx, sessionId);
    if (quantity === 0) {
      await tx.cartItem.deleteMany({ where: { sessionId, variantId } });
      return getCart(sessionId, tx);
    }
    const v = await tx.variant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!v || !v.active || !v.product.active || !v.product.demo)
      throw new CommerceError(
        "UNAVAILABLE",
        "Esta variante no está disponible.",
      );
    if (v.stock - v.reserved < quantity)
      throw new CommerceError(
        "OUT_OF_STOCK",
        "La cantidad supera las existencias disponibles.",
      );
    const count = await tx.cartItem.count({ where: { sessionId } });
    const exists = await tx.cartItem.findUnique({
      where: { sessionId_variantId: { sessionId, variantId } },
    });
    if (!exists && count >= 30)
      throw new CommerceError(
        "CART_LIMIT",
        "La bolsa admite hasta 30 variantes.",
      );
    await tx.cartItem.upsert({
      where: { sessionId_variantId: { sessionId, variantId } },
      create: { sessionId, variantId, quantity },
      update: { quantity },
    });
    return getCart(sessionId, tx);
  });
}

async function calculateQuote(tx: Tx, sessionId: string, input: CheckoutInput) {
  const items = await getCart(sessionId, tx);
  if (!items.length)
    throw new CommerceError("EMPTY_CART", "Tu bolsa está vacía.");
  if (items.some((i) => !i.available || i.quantity > i.stock))
    throw new CommerceError(
      "OUT_OF_STOCK",
      "Una pieza cambió de disponibilidad. Revisa tu bolsa.",
    );
  const rate = await tx.shippingRate.findUnique({
    where: { id: input.shippingRateId },
  });
  if (!rate?.active || !rate.demo)
    throw new CommerceError(
      "NO_SHIPPING",
      "Elige un destino de prueba disponible.",
    );
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const coupon = input.coupon
    ? await tx.coupon.findUnique({ where: { code: input.coupon } })
    : null;
  if (
    input.coupon &&
    (!coupon?.active ||
      !coupon.demo ||
      coupon.expiresAt <= new Date() ||
      coupon.used >= coupon.usageLimit ||
      subtotal < coupon.minimum)
  )
    throw new CommerceError(
      "INVALID_COUPON",
      "El cupón no es válido, está agotado o no cumple el mínimo.",
    );
  const discount = coupon ? Math.floor((subtotal * coupon.percent) / 100) : 0;
  const total = subtotal - discount + rate.amount;
  if (!Number.isSafeInteger(total) || total > 100000000)
    throw new CommerceError(
      "AMOUNT_LIMIT",
      "El importe supera el límite de esta prueba.",
    );
  const quoteHash = hash({
    items: items.map((i) => ({
      variantId: i.variantId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    shipping: rate.id,
    shippingAmount: rate.amount,
    coupon: coupon?.code ?? null,
    discount,
    total,
  });
  return {
    items,
    subtotal,
    discount,
    shipping: rate.amount,
    total,
    currency: "COP" as const,
    shippingRateId: rate.id,
    shippingLabel: `${rate.city}, ${rate.department}`,
    coupon: coupon?.code ?? null,
    quoteHash,
    demo: true,
  };
}

export async function quoteCart(sessionId: string, input: unknown) {
  const parsed = checkoutSchema.parse(input);
  return transaction(async (tx) => {
    await lockSession(tx, sessionId);
    return calculateQuote(tx, sessionId, parsed);
  });
}

function requireDemoCheckout() {
  if (
    process.env.APP_ENV !== "development" ||
    process.env.DEMO_CHECKOUT_ENABLED !== "true"
  )
    throw new CommerceError(
      "CHECKOUT_CLOSED",
      "Los pedidos de prueba no están habilitados.",
      503,
    );
}

export async function createOrder(sessionId: string, input: unknown) {
  requireDemoCheckout();
  const parsed = orderSchema.parse(input);
  const requestHash = hash(parsed);
  return transaction(async (tx) => {
    await lockSession(tx, sessionId);
    const existing = await tx.order.findUnique({
      where: {
        sessionId_idempotencyKey: {
          sessionId,
          idempotencyKey: parsed.idempotencyKey,
        },
      },
      include: { items: true },
    });
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new CommerceError(
          "IDEMPOTENCY_CONFLICT",
          "Este intento ya se usó con otros datos.",
        );
      return existing;
    }
    const quote = await calculateQuote(tx, sessionId, parsed);
    if (quote.quoteHash !== parsed.quoteHash)
      throw new CommerceError(
        "QUOTE_CHANGED",
        "El importe cambió. Revisa el resumen actualizado antes de confirmar.",
      );
    if (quote.coupon) {
      const changed =
        await tx.$executeRaw`UPDATE "Coupon" SET "used"="used"+1 WHERE "code"=${quote.coupon} AND "active"=true AND "used"<"usageLimit" AND "expiresAt">NOW()`;
      if (changed !== 1)
        throw new CommerceError(
          "INVALID_COUPON",
          "El cupón acaba de agotarse.",
        );
    }
    for (const item of quote.items) {
      const changed =
        await tx.$executeRaw`UPDATE "Variant" SET "reserved"="reserved"+${item.quantity}, "updatedAt"=NOW() WHERE "id"=${item.variantId} AND "active"=true AND "stock"-"reserved">=${item.quantity}`;
      if (changed !== 1)
        throw new CommerceError(
          "OUT_OF_STOCK",
          "Otra reserva tomó las últimas unidades. Revisa tu bolsa.",
        );
    }
    const order = await tx.order.create({
      data: {
        number: `PRUEBA-${randomUUID().toUpperCase()}`,
        sessionId,
        idempotencyKey: parsed.idempotencyKey,
        requestHash,
        subtotal: quote.subtotal,
        discount: quote.discount,
        shipping: quote.shipping,
        total: quote.total,
        couponCode: quote.coupon,
        recipient: parsed.recipient,
        shippingLabel: quote.shippingLabel,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        items: {
          create: await Promise.all(
            quote.items.map(async (item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              productName: item.name,
              variantLabel: item.label,
              sku: (
                await tx.variant.findUniqueOrThrow({
                  where: { id: item.variantId },
                })
              ).sku,
            })),
          ),
        },
      },
      include: { items: true },
    });
    await tx.inventoryMovement.createMany({
      data: quote.items.map((i) => ({
        variantId: i.variantId,
        orderId: order.id,
        kind: "RESERVE" as const,
        quantity: i.quantity,
        reason: "Reserva de pedido de prueba; sin pago",
      })),
    });
    await tx.cartItem.deleteMany({ where: { sessionId } });
    return order;
  });
}

export async function release(
  tx: Tx,
  id: string,
  status: "CANCELLED" | "EXPIRED",
  sessionId?: string,
  reason?: string,
) {
  const order = await tx.order.findFirst({
    where: { id, ...(sessionId ? { sessionId } : {}) },
    include: { items: { orderBy: { variantId: "asc" } } },
  });
  if (!order)
    throw new CommerceError(
      "NOT_FOUND",
      "No encontramos ese pedido en tu sesión.",
      404,
    );
  const changed = await tx.order.updateMany({
    where: {
      id,
      status: "RESERVED",
      ...(status === "EXPIRED" ? { expiresAt: { lte: new Date() } } : {}),
    },
    data: { status, version: { increment: 1 } },
  });
  if (changed.count) {
    for (const item of order.items) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: { reserved: { decrement: item.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          variantId: item.variantId,
          orderId: id,
          kind: "RELEASE",
          quantity: item.quantity,
          reason:
            reason ??
            (status === "EXPIRED"
              ? "Reserva de prueba vencida"
              : "Cancelación de prueba por su propietario"),
        },
      });
    }
    if (order.couponCode)
      await tx.coupon.update({
        where: { code: order.couponCode },
        data: { used: { decrement: 1 } },
      });
  }
  return tx.order.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
}
export async function cancelOrder(sessionId: string, id: string) {
  return transaction((tx) => release(tx, id, "CANCELLED", sessionId));
}
export async function releaseExpired() {
  const ids = await getDb().order.findMany({
    where: { status: "RESERVED", expiresAt: { lte: new Date() } },
    select: { id: true },
    take: 100,
    orderBy: { expiresAt: "asc" },
  });
  for (const { id } of ids)
    await transaction((tx) => release(tx, id, "EXPIRED"));
  return ids.length;
}

export async function listOrders(sessionId: string) {
  // PII and request/session hashes are intentionally excluded from responses.
  return getDb().order.findMany({
    where: { sessionId },
    select: {
      id: true,
      number: true,
      status: true,
      subtotal: true,
      discount: true,
      shipping: true,
      total: true,
      currency: true,
      demo: true,
      shippingLabel: true,
      expiresAt: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          variantLabel: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
