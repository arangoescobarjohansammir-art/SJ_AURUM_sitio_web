import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/lib/db";
import {
  setCartQuantity,
  quoteCart,
  createOrder,
  cancelOrder,
  releaseExpired,
  listOrders,
  CommerceError,
} from "../src/modules/commerce/service";

const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Las pruebas solo se ejecutan en PostgreSQL local:55432");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.toString();
process.env.APP_ENV = "development";
process.env.DEMO_CHECKOUT_ENABLED = "true";
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, stdio: "inherit", windowsHide: true },
);
if (migration.status !== 0) throw Error("Falló la migración de pruebas");
const db = getDb();
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
const tag = randomUUID();
async function session() {
  return (
    await db.visitorSession.create({
      data: {
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    })
  ).id;
}
async function item(stock = 5, price = 100000) {
  const id = `test-${randomUUID()}`;
  await db.product.create({
    data: {
      id,
      slug: id,
      name: "Producto de prueba",
      category: "Cadenas",
      description: "Prueba técnica",
      image: "/images/product-1.jpg",
      gallery: [],
      demo: true,
      active: true,
      variants: { create: { id, sku: id, label: "Prueba", stock, price } },
    },
  });
  return id;
}
const rate = `test-rate-${tag}`;
const recipient = {
  name: "Cliente de prueba",
  email: "prueba@example.invalid",
  phone: "3000000000",
  address: "Dirección ficticia de prueba",
  additional: "No despachar",
};
async function payload(sid: string, coupon = "") {
  const quote = await quoteCart(sid, { shippingRateId: rate, coupon });
  return {
    shippingRateId: rate,
    coupon,
    recipient,
    quoteHash: quote.quoteHash,
    idempotencyKey: randomUUID(),
    acceptedDemo: true as const,
  };
}
try {
  await db.shippingRate.create({
    data: {
      id: rate,
      department: tag,
      city: "Pruebas",
      amount: 12000,
      active: true,
    },
  });
  await check(
    "precios calculados por servidor y rechazo de cantidades inválidas",
    async () => {
      const s = await session(),
        v = await item();
      await setCartQuantity(s, { variantId: v, quantity: 2, price: 1 });
      const q = await quoteCart(s, { shippingRateId: rate });
      assert.equal(q.total, 212000);
      await assert.rejects(() =>
        setCartQuantity(s, { variantId: v, quantity: -1 }),
      );
      await assert.rejects(() =>
        setCartQuantity(s, { variantId: v, quantity: 1.2 }),
      );
    },
  );
  await check("última unidad: solo una reserva concurrente", async () => {
    const v = await item(1),
      a = await session(),
      b = await session();
    await setCartQuantity(a, { variantId: v, quantity: 1 });
    await setCartQuantity(b, { variantId: v, quantity: 1 });
    const pa = await payload(a),
      pb = await payload(b);
    const result = await Promise.allSettled([
      createOrder(a, pa),
      createOrder(b, pb),
    ]);
    assert.equal(result.filter((r) => r.status === "fulfilled").length, 1);
    const loser = result.find((r) => r.status === "rejected");
    assert.ok(
      loser?.status === "rejected" &&
        loser.reason instanceof CommerceError &&
        loser.reason.code === "OUT_OF_STOCK",
    );
    assert.equal(
      (await db.variant.findUniqueOrThrow({ where: { id: v } })).reserved,
      1,
    );
  });
  await check(
    "reintento concurrente no duplica pedido, stock ni movimientos",
    async () => {
      const s = await session(),
        v = await item();
      await setCartQuantity(s, { variantId: v, quantity: 2 });
      const p = await payload(s);
      const [a, b] = await Promise.all([createOrder(s, p), createOrder(s, p)]);
      assert.equal(a.id, b.id);
      assert.equal(
        await db.inventoryMovement.count({
          where: { orderId: a.id, kind: "RESERVE" },
        }),
        1,
      );
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: v } })).reserved,
        2,
      );
      await assert.rejects(
        () =>
          createOrder(s, {
            ...p,
            recipient: { ...recipient, name: "Otro nombre" },
          }),
        (e: unknown) =>
          e instanceof CommerceError && e.code === "IDEMPOTENCY_CONFLICT",
      );
    },
  );
  await check(
    "cancelación privada e idempotente devuelve stock una sola vez",
    async () => {
      const s = await session(),
        other = await session(),
        v = await item();
      await setCartQuantity(s, { variantId: v, quantity: 2 });
      const o = await createOrder(s, await payload(s));
      await assert.rejects(
        () => cancelOrder(other, o.id),
        (e: unknown) => e instanceof CommerceError && e.status === 404,
      );
      assert.equal((await listOrders(other)).length, 0);
      await Promise.all([cancelOrder(s, o.id), cancelOrder(s, o.id)]);
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: v } })).reserved,
        0,
      );
      assert.equal(
        await db.inventoryMovement.count({
          where: { orderId: o.id, kind: "RELEASE" },
        }),
        1,
      );
    },
  );
  await check("cambio de precio exige nueva revisión", async () => {
    const s = await session(),
      v = await item();
    await setCartQuantity(s, { variantId: v, quantity: 1 });
    const p = await payload(s);
    await db.variant.update({ where: { id: v }, data: { price: 110000 } });
    await assert.rejects(
      () => createOrder(s, p),
      (e: unknown) => e instanceof CommerceError && e.code === "QUOTE_CHANGED",
    );
    assert.equal(await db.order.count({ where: { sessionId: s } }), 0);
  });
  await check(
    "cupón limitado no se utiliza dos veces en concurrencia",
    async () => {
      const code = `TEST-${tag.replaceAll("-", "")}`.toUpperCase();
      await db.coupon.create({
        data: {
          code,
          percent: 10,
          usageLimit: 1,
          active: true,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const a = await session(),
        b = await session();
      await setCartQuantity(a, { variantId: await item(), quantity: 1 });
      await setCartQuantity(b, { variantId: await item(), quantity: 1 });
      const pa = await payload(a, code),
        pb = await payload(b, code);
      const results = await Promise.allSettled([
        createOrder(a, pa),
        createOrder(b, pb),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const winner = results.find((r) => r.status === "fulfilled");
      assert.ok(winner?.status === "fulfilled");
      assert.equal(winner.value.total, 102000);
      await db.order.update({
        where: { id: winner.value.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await Promise.all([releaseExpired(), releaseExpired()]);
      assert.equal(
        (await db.coupon.findUniqueOrThrow({ where: { code } })).used,
        0,
      );
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: winner.value.id } }))
          .status,
        "EXPIRED",
      );
    },
  );
  await check("restricción SQL impide inventario negativo", async () => {
    const v = await item();
    await assert.rejects(() =>
      db.variant.update({ where: { id: v }, data: { stock: -1 } }),
    );
  });
  await check(
    "pedidos de prueba cerrados fuera del entorno de desarrollo",
    async () => {
      process.env.APP_ENV = "production";
      await assert.rejects(
        () => createOrder("irrelevant", {}),
        (e: unknown) =>
          e instanceof CommerceError && e.code === "CHECKOUT_CLOSED",
      );
      process.env.APP_ENV = "development";
    },
  );
  console.log(`${passed} pruebas de integración PostgreSQL aprobadas.`);
} finally {
  await db.$disconnect();
}
