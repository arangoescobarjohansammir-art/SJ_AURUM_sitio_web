import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/lib/db";
import {
  register,
  login,
  issueToken,
  consumeToken,
} from "../src/modules/auth/service";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
import {
  listAdminOrders,
  adminOrderDetail,
  changeAdminOrder,
} from "../src/modules/admin/orders-service";
import {
  setCartQuantity,
  quoteCart,
  createOrder,
  cancelOrder,
  releaseExpired,
  listOrders,
} from "../src/modules/commerce/service";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo base local");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.toString();
process.env.APP_ENV = "development";
process.env.DEMO_CHECKOUT_ENABLED = "true";
const m = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, stdio: "inherit", windowsHide: true },
);
if (m.status !== 0) throw Error("Migration failed");
const db = getDb(),
  tag = randomUUID(),
  email = "orders-" + tag + "@example.invalid",
  password = "Prueba exclusiva " + randomUUID(),
  reason = "Revisión administrativa de ejemplo";
let token = "",
  count = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log("PASS " + name);
  count++;
}
try {
  const user = await register({
    name: "Operador pedidos",
    email,
    password,
    acceptedDemo: true,
  });
  const client = (await login({ email, password })).token;
  await check("permisos en listado, detalle y escritura", async () => {
    await assert.rejects(() => listAdminOrders(undefined, {}), {
      code: "AUTH_REQUIRED",
    });
    await assert.rejects(() => listAdminOrders(client, {}), {
      code: "FORBIDDEN",
    });
    await assert.rejects(() => adminOrderDetail(client, "unknown"), {
      code: "FORBIDDEN",
    });
    await assert.rejects(() => changeAdminOrder(client, "unknown", {}), {
      code: "FORBIDDEN",
    });
  });
  const link = await issueToken(email, "VERIFY");
  assert.ok(link);
  await consumeToken({ token: link.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  token = (await login({ email, password })).token;
  const session = await db.visitorSession.create({
    data: {
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  await db.product.create({
    data: {
      id: tag,
      slug: tag,
      name: "Pieza de prueba",
      category: "Cadenas",
      description: "Prueba",
      image: "/images/product-1.jpg",
      gallery: [],
      active: true,
      variants: {
        create: { id: tag, sku: tag, label: "45 cm", price: 100000, stock: 50 },
      },
    },
  });
  await db.shippingRate.create({
    data: { id: tag, department: tag, city: tag, amount: 12000, active: true },
  });
  await db.coupon.create({
    data: {
      code: tag.toUpperCase(),
      percent: 10,
      usageLimit: 50,
      active: true,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  async function order() {
    await setCartQuantity(session.id, { variantId: tag, quantity: 1 });
    const q = await quoteCart(session.id, {
      shippingRateId: tag,
      coupon: tag.toUpperCase(),
    });
    return createOrder(session.id, {
      shippingRateId: tag,
      coupon: tag.toUpperCase(),
      quoteHash: q.quoteHash,
      idempotencyKey: randomUUID(),
      acceptedDemo: true,
      recipient: {
        name: "Destinatario " + tag,
        email,
        phone: "3000000000",
        address: "Dirección ficticia 123",
        additional: "",
      },
    });
  }
  const first = await order();
  await check(
    "búsqueda por número y destinatario, filtros, paginación y privacidad",
    async () => {
      for (const query of [
        first.number,
        email.toUpperCase(),
        "Destinatario " + tag,
      ]) {
        const found = await listAdminOrders(token, { query });
        assert.equal(found.total, 1);
        assert.equal(found.orders[0].id, first.id);
        assert.ok(!("recipient" in found.orders[0]));
      }
      assert.equal(
        (await listAdminOrders(token, { query: email, status: "CANCELLED" }))
          .total,
        0,
      );
      await assert.rejects(() => listAdminOrders(token, { page: 0 }));
      const detail = await adminOrderDetail(token, first.id);
      assert.equal((detail.order.recipient as { email: string }).email, email);
      assert.ok(!("sessionId" in detail.order));
      assert.ok(!("requestHash" in detail.order));
      assert.equal(detail.order.total, 102000);
      assert.equal(
        (await listAdminOrders(token, { query: email, page: 999 })).page,
        1,
      );
    },
  );
  await check("notas auditadas, validación y edición concurrente", async () => {
    await assert.rejects(() =>
      changeAdminOrder(token, first.id, {
        action: "FOLLOW_UP",
        followUp: "PAID",
        reason,
        expectedVersion: 0,
      }),
    );
    const jobs = await Promise.allSettled(
      ["REVIEWED", "ISSUE"].map((followUp) =>
        changeAdminOrder(token, first.id, {
          action: "FOLLOW_UP",
          followUp,
          reason,
          expectedVersion: 0,
        }),
      ),
    );
    assert.equal(jobs.filter((j) => j.status === "fulfilled").length, 1);
    const detail = await adminOrderDetail(token, first.id);
    assert.equal(detail.history.length, 1);
    assert.equal(detail.history[0].actor.name, "Operador pedidos");
    assert.equal(detail.order.version, 1);
    assert.equal(
      (
        await listAdminOrders(token, {
          query: email,
          followUp: detail.order.followUp,
        })
      ).total,
      1,
    );
    const publicOrders = await listOrders(session.id);
    assert.ok(!("followUp" in publicOrders[0]));
    assert.ok(!("history" in publicOrders[0]));
  });
  await check(
    "cancelación repetida libera stock y cupón una sola vez",
    async () => {
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          changeAdminOrder(token, first.id, {
            action: "CANCEL",
            reason,
            expectedVersion: 1,
          }),
        ),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: tag } })).reserved,
        0,
      );
      assert.equal(
        (
          await db.coupon.findUniqueOrThrow({
            where: { code: tag.toUpperCase() },
          })
        ).used,
        0,
      );
      const detail = await adminOrderDetail(token, first.id);
      assert.equal(detail.order.status, "CANCELLED");
      assert.equal(detail.history.length, 2);
      assert.equal(
        detail.order.movements.find((x) => x.kind === "RELEASE")?.reason,
        "Cancelación administrativa: " + reason,
      );
      assert.equal(
        detail.order.movements.filter((x) => x.kind === "RELEASE").length,
        1,
      );
    },
  );
  await check(
    "cancelación simultánea del cliente y administrador conserva inventario",
    async () => {
      const o = await order();
      await Promise.allSettled([
        cancelOrder(session.id, o.id),
        changeAdminOrder(token, o.id, {
          action: "CANCEL",
          reason,
          expectedVersion: 0,
        }),
      ]);
      const detail = await adminOrderDetail(token, o.id);
      assert.equal(detail.order.status, "CANCELLED");
      assert.equal(
        detail.order.movements.filter((x) => x.kind === "RELEASE").length,
        1,
      );
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: tag } })).reserved,
        0,
      );
    },
  );
  await check(
    "vencimiento conserva estado real, historial y bloqueo de cancelación",
    async () => {
      const o = await order();
      await db.order.update({
        where: { id: o.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await assert.rejects(
        () =>
          changeAdminOrder(token, o.id, {
            action: "CANCEL",
            reason,
            expectedVersion: 0,
          }),
        { code: "ORDER_CLOSED" },
      );
      await Promise.all([
        listAdminOrders(token, { query: email }),
        releaseExpired(),
      ]);
      const detail = await adminOrderDetail(token, o.id);
      assert.equal(detail.order.status, "EXPIRED");
      assert.equal(
        detail.order.movements.filter((x) => x.kind === "RELEASE").length,
        1,
      );
      await changeAdminOrder(token, o.id, {
        action: "FOLLOW_UP",
        followUp: "RESOLVED",
        reason,
        expectedVersion: detail.order.version,
      });
      assert.equal(
        (await adminOrderDetail(token, o.id)).order.status,
        "EXPIRED",
      );
    },
  );
  await check(
    "pedidos ajenos al demo y sesiones revocadas quedan excluidos",
    async () => {
      await db.order.update({ where: { id: first.id }, data: { demo: false } });
      await assert.rejects(() => adminOrderDetail(token, first.id), {
        code: "NOT_FOUND",
      });
      await assert.rejects(
        () =>
          changeAdminOrder(token, first.id, {
            action: "CANCEL",
            reason,
            expectedVersion: 2,
          }),
        { code: "NOT_FOUND" },
      );
      await changeDevelopmentRole(email, "revoke");
      await assert.rejects(() => listAdminOrders(token, {}), {
        code: "AUTH_REQUIRED",
      });
    },
  );
  console.log(count + " grupos de administración de pedidos aprobados.");
} finally {
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await db.$disconnect();
}
