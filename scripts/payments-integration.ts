import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/lib/db";
import {
  createOrder,
  setCartQuantity,
  quoteCart,
  cancelOrder,
  releaseExpired,
} from "../src/modules/commerce/service";
import {
  startPayment,
  applyTransaction,
  receiveEvent,
  syncPayment,
  refundPayment,
} from "../src/modules/payments/service";
import {
  register,
  login,
  issueToken,
  consumeToken,
} from "../src/modules/auth/service";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
import type { WompiTransaction } from "../src/modules/payments/wompi";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo base local");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.href;
process.env.APP_ENV = "development";
process.env.DEMO_CHECKOUT_ENABLED = "true";
process.env.WOMPI_ENVIRONMENT = "sandbox";
process.env.WOMPI_PUBLIC_KEY = "pub_test_fixture";
process.env.WOMPI_PRIVATE_KEY = "prv_test_fixture";
process.env.WOMPI_EVENTS_SECRET = "test_events_fixture";
process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_fixture";
if (
  spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, stdio: "inherit", windowsHide: true },
  ).status !== 0
)
  throw Error("Migration failed");
const db = getDb(),
  tag = randomUUID(),
  originalFetch = globalThis.fetch;
const email = "payments-" + tag + "@example.invalid",
  password = "Prueba local " + tag;
let count = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  console.log("PASS " + name);
  count++;
}
async function fixture() {
  const id = randomUUID();
  const session = await db.visitorSession.create({
    data: { tokenHash: id, expiresAt: new Date(Date.now() + 86400000) },
  });
  await db.product.create({
    data: {
      id,
      slug: id,
      name: "Pago ficticio",
      category: "Cadenas",
      description: "Prueba",
      image: "/images/product-1.jpg",
      gallery: [],
      active: true,
      variants: {
        create: { id, sku: id, label: "Prueba", price: 100000, stock: 2 },
      },
    },
  });
  await setCartQuantity(session.id, { variantId: id, quantity: 1 });
  const q = await quoteCart(session.id, { shippingRateId: tag });
  const order = await createOrder(session.id, {
    shippingRateId: tag,
    quoteHash: q.quoteHash,
    idempotencyKey: randomUUID(),
    acceptedDemo: true,
    recipient: {
      name: "Cliente de prueba",
      email: "cliente@example.invalid",
      phone: "3000000000",
      address: "Dirección ficticia 123",
      additional: "No enviar",
    },
  });
  const start = await startPayment(session.id, order.id);
  const data: WompiTransaction = {
    id: "test-" + randomUUID(),
    reference: new URL(start.url).searchParams.get("reference")!,
    currency: "COP",
    amount_in_cents: order.total * 100,
    status: "APPROVED",
  };
  return { order, session, variant: id, start, data };
}
try {
  await db.shippingRate.create({
    data: {
      id: tag,
      department: tag,
      city: "Prueba",
      amount: 10000,
      active: true,
    },
  });
  await check(
    "checkout idempotente y aislamiento del propietario",
    async () => {
      const f = await fixture();
      assert.deepEqual(await startPayment(f.session.id, f.order.id), f.start);
      await assert.rejects(() => startPayment("otra-sesion", f.order.id));
      await assert.rejects(() =>
        applyTransaction({ ...f.data, amount_in_cents: 1 }),
      );
      await assert.rejects(() => applyTransaction(f.data, "otra-sesion"));
    },
  );
  await check(
    "aprobaciones concurrentes descuentan una sola vez; no regresan a pendiente",
    async () => {
      const f = await fixture();
      await Promise.all([applyTransaction(f.data), applyTransaction(f.data)]);
      await applyTransaction({ ...f.data, status: "PENDING" });
      const v = await db.variant.findUniqueOrThrow({
        where: { id: f.variant },
      });
      assert.equal(v.stock, 1);
      assert.equal(v.reserved, 0);
      assert.equal(
        await db.inventoryMovement.count({
          where: { orderId: f.order.id, kind: "SALE" },
        }),
        1,
      );
      await cancelOrder(f.session.id, f.order.id);
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: f.order.id } }))
          .status,
        "PAID",
      );
    },
  );
  await check("rechazo libera reserva e impide reusar pago", async () => {
    const f = await fixture();
    await applyTransaction({ ...f.data, status: "DECLINED" });
    assert.equal(
      (await db.variant.findUniqueOrThrow({ where: { id: f.variant } }))
        .reserved,
      0,
    );
    await assert.rejects(() => startPayment(f.session.id, f.order.id));
  });
  await check(
    "pago tardío o cancelado exige revisión y no consume existencias",
    async () => {
      for (const expired of [true, false]) {
        const f = await fixture();
        if (expired) {
          await db.order.update({
            where: { id: f.order.id },
            data: { expiresAt: new Date(0) },
          });
          await releaseExpired();
        } else await cancelOrder(f.session.id, f.order.id);
        await applyTransaction(f.data);
        assert.equal(
          (await db.order.findUniqueOrThrow({ where: { id: f.order.id } }))
            .status,
          "PAYMENT_REVIEW",
        );
        const v = await db.variant.findUniqueOrThrow({
          where: { id: f.variant },
        });
        assert.equal(v.stock, 2);
        assert.equal(v.reserved, 0);
      }
    },
  );
  await check(
    "webhook consulta al proveedor y retorno no confía en datos del navegador",
    async () => {
      const f = await fixture();
      let requests = 0;
      globalThis.fetch = async () => {
        requests++;
        return Response.json({ data: f.data });
      };
      const checksum = createHash("sha256")
        .update(f.data.id + "123test_events_fixture")
        .digest("hex");
      await receiveEvent({
        event: "transaction.updated",
        environment: "test",
        timestamp: 123,
        data: { transaction: { ...f.data, reference: "manipulada" } },
        signature: { properties: ["transaction.id"], checksum },
      });
      assert.equal(requests, 1);
      await assert.rejects(() => syncPayment("otra-sesion", f.data.id));
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: f.order.id } }))
          .status,
        "PAID",
      );
    },
  );
  await register({
    email,
    password,
    name: "Administrador de pruebas",
    acceptedDemo: true,
  });
  const verify = await issueToken(email, "VERIFY");
  await consumeToken({ token: verify!.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  const token = (await login({ email, password })).token;
  await check(
    "reembolso total auditado, concurrencia y existencias sin reposición automática",
    async () => {
      const f = await fixture();
      await applyTransaction(f.data);
      let requests = 0;
      globalThis.fetch = async () => {
        requests++;
        return Response.json({
          data: {
            id: "refund-test",
            status: "APPROVED",
            transaction_id: f.data.id,
            amount_in_cents: f.data.amount_in_cents,
          },
        });
      };
      await assert.rejects(() =>
        refundPayment(undefined, f.order.id, { reason: "Prueba reembolso" }),
      );
      const outcomes = await Promise.allSettled([
        refundPayment(token, f.order.id, { reason: "Prueba reembolso" }),
        refundPayment(token, f.order.id, { reason: "Prueba reembolso" }),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(requests, 1);
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: f.order.id } }))
          .status,
        "REFUNDED",
      );
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: f.variant } }))
          .stock,
        1,
      );
      assert.equal(
        await db.adminAudit.count({
          where: { entityId: f.order.id, action: "PAYMENT_REFUND" },
        }),
        1,
      );
    },
  );
  await check("timeout de reembolso no permite un segundo envío", async () => {
    const f = await fixture();
    await applyTransaction(f.data);
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      throw Error("timeout");
    };
    await assert.rejects(
      () => refundPayment(token, f.order.id, { reason: "Prueba de timeout" }),
      { code: "REFUND_UNKNOWN" },
    );
    await assert.rejects(
      () => refundPayment(token, f.order.id, { reason: "Prueba de timeout" }),
      { code: "REFUND_EXISTS" },
    );
    assert.equal(requests, 1);
  });
  console.log(`${count} grupos de pagos aprobados (proveedor simulado).`);
} finally {
  globalThis.fetch = originalFetch;
  const customer = await db.customer.findUnique({ where: { email } });
  if (customer?.role === "ADMIN") await changeDevelopmentRole(email, "revoke");
  await db.$disconnect();
}
