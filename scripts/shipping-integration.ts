import {
  listRates,
  saveRate,
  updateShipment,
} from "../src/modules/shipping/service";
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

  const rateInput = {
    department: tag + " departamento",
    city: tag + " ciudad",
    amount: 15000,
    carrier: "Transportadora ficticia",
    minDays: 2,
    maxDays: 5,
    active: true,
    reason,
  };
  await check(
    "tarifas: permisos, validación, duplicados y concurrencia",
    async () => {
      await assert.rejects(() => listRates(undefined), {
        code: "AUTH_REQUIRED",
      });
      await assert.rejects(() => saveRate(client, rateInput));
      await assert.rejects(() => saveRate(token, { ...rateInput, minDays: 6 }));
      const r = await saveRate(token, rateInput);
      await assert.rejects(() => saveRate(token, rateInput), {
        code: "DUPLICATE_DESTINATION",
      });
      await saveRate(token, {
        ...rateInput,
        id: r.id,
        expectedVersion: 0,
        active: false,
      });
      await assert.rejects(
        () => saveRate(token, { ...rateInput, id: r.id, expectedVersion: 0 }),
        { code: "EDIT_CONFLICT" },
      );
    },
  );
  const owner = await db.customer.findUniqueOrThrow({ where: { email } });
  const address = await db.address.create({
    data: {
      customerId: owner.id,
      label: "Ejemplo",
      recipient: "Destinatario guardado",
      phone: "3000000000",
      department: tag,
      city: tag,
      street: "Calle ficticia 123",
      additional: "Solo prueba",
    },
  });
  await setCartQuantity(owner.cartSessionId, { variantId: tag, quantity: 1 });
  await setCartQuantity(session.id, { variantId: tag, quantity: 1 });
  const input = { shippingRateId: tag, addressId: address.id };
  const recipient = {
    name: "Nombre cliente",
    email,
    phone: "3000000000",
    address: "Dirección manipulada 123",
    additional: "",
  };
  await check("direcciones privadas y cobertura del servidor", async () => {
    await assert.rejects(() => quoteCart(session.id, input), {
      code: "ADDRESS_NOT_FOUND",
    });
    await db.address.update({
      where: { id: address.id },
      data: { city: "Fuera de cobertura" },
    });
    await assert.rejects(() => quoteCart(owner.cartSessionId, input), {
      code: "NO_SHIPPING",
    });
    await db.address.update({ where: { id: address.id }, data: { city: tag } });
  });
  await check(
    "cambio de dirección invalida resumen; pedido conserva instantánea",
    async () => {
      const q = await quoteCart(owner.cartSessionId, input);
      await db.address.update({
        where: { id: address.id },
        data: { street: "Calle ficticia 456" },
      });
      await assert.rejects(
        () =>
          createOrder(owner.cartSessionId, {
            ...input,
            recipient,
            quoteHash: q.quoteHash,
            idempotencyKey: randomUUID(),
            acceptedDemo: true,
          }),
        { code: "QUOTE_CHANGED" },
      );
      const q2 = await quoteCart(owner.cartSessionId, input);
      const o = await createOrder(owner.cartSessionId, {
        ...input,
        recipient,
        quoteHash: q2.quoteHash,
        idempotencyKey: randomUUID(),
        acceptedDemo: true,
      });
      assert.equal(
        (o.recipient as { address: string }).address,
        "Calle ficticia 456",
      );
      await db.address.update({
        where: { id: address.id },
        data: { street: "Calle ficticia 789" },
      });
      assert.equal(
        (
          (await db.order.findUniqueOrThrow({ where: { id: o.id } }))
            .recipient as { address: string }
        ).address,
        "Calle ficticia 456",
      );
    },
  );
  await check(
    "tarifa modificada o desactivada invalida el checkout",
    async () => {
      await setCartQuantity(owner.cartSessionId, {
        variantId: tag,
        quantity: 1,
      });
      const q = await quoteCart(owner.cartSessionId, input);
      const rate = await db.shippingRate.findUniqueOrThrow({
        where: { id: tag },
      });
      await saveRate(token, {
        ...rate,
        expectedVersion: rate.version,
        carrier: "Nueva transportadora ficticia",
        reason,
      });
      await assert.rejects(
        () =>
          createOrder(owner.cartSessionId, {
            ...input,
            recipient,
            quoteHash: q.quoteHash,
            idempotencyKey: randomUUID(),
            acceptedDemo: true,
          }),
        { code: "QUOTE_CHANGED" },
      );
      await saveRate(token, {
        ...rate,
        expectedVersion: rate.version + 1,
        active: false,
        reason,
      });
      await assert.rejects(() => quoteCart(owner.cartSessionId, input), {
        code: "NO_SHIPPING",
      });
      await saveRate(token, {
        ...rate,
        expectedVersion: rate.version + 2,
        active: true,
        reason,
      });
    },
  );
  const first = await order();
  const shipment = {
    expectedVersion: 0,
    status: "PREPARING",
    carrier: "Transportadora ficticia",
    trackingNumber: "",
    note: "Preparación ficticia del pedido",
  };
  await check(
    "bloqueo sin pago, transiciones, guía, versiones y privacidad",
    async () => {
      await assert.rejects(() => updateShipment(token, first.id, shipment), {
        code: "SHIPPING_BLOCKED",
      });
      await db.payment.create({
        data: {
          orderId: first.id,
          reference: randomUUID(),
          status: "APPROVED",
        },
      });
      await db.order.update({
        where: { id: first.id },
        data: { status: "PAID" },
      });
      await assert.rejects(
        () =>
          updateShipment(token, first.id, {
            ...shipment,
            status: "DELIVERED",
            trackingNumber: "GUIA-123",
          }),
        { code: "INVALID_TRANSITION" },
      );
      await updateShipment(token, first.id, shipment);
      await assert.rejects(() => updateShipment(token, first.id, shipment), {
        code: "EDIT_CONFLICT",
      });
      await assert.rejects(() =>
        updateShipment(token, first.id, {
          ...shipment,
          expectedVersion: 1,
          status: "SHIPPED",
        }),
      );
      await updateShipment(token, first.id, {
        ...shipment,
        expectedVersion: 1,
        status: "SHIPPED",
        trackingNumber: "GUIA-123",
      });
      await updateShipment(token, first.id, {
        ...shipment,
        expectedVersion: 2,
        status: "DELIVERED",
        trackingNumber: "GUIA-123",
      });
      const publicOrder = (await listOrders(session.id)).find(
        (o) => o.id === first.id,
      )!;
      assert.equal(publicOrder.shippingStatus, "DELIVERED");
      assert.equal(publicOrder.shippingEvents.length, 3);
      assert.ok(!("recipient" in publicOrder));
      assert.equal(
        await db.adminAudit.count({
          where: { entityId: first.id, action: "SHIPMENT_UPDATE" },
        }),
        3,
      );
      assert.ok(
        !(await listOrders(owner.cartSessionId)).some((o) => o.id === first.id),
      );
    },
  );
  console.log(count + " grupos de envíos aprobados.");
} finally {
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await db.$disconnect();
}
