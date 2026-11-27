import {
  quoteEnvia,
  generateEnvia,
  enviaStatus,
  trackEnvia,
} from "../src/modules/shipping/envia-service";
import { updateShipment } from "../src/modules/shipping/service";
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
const click = process.argv.includes("--envioclick");
process.env.SHIPPING_PROVIDER = click ? "envioclick" : "envia";
process.env.ENVIOCLICK_ENVIRONMENT = "sandbox";
process.env.ENVIOCLICK_API_KEY = "fixture-envioclick-key-not-real";
process.env.MAIL_PROVIDER = "local";
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
const originalFetch = globalThis.fetch;
process.env.ENVIA_ENVIRONMENT = "sandbox";
process.env.ENVIA_API_TOKEN = "test-fixture-not-a-real-token";
let calls = 0,
  generateCalls = 0,
  failGenerate = false;
globalThis.fetch = async (url, options) => {
  calls++;
  assert.ok(
    String(url).startsWith(
      click
        ? "https://api.envioclickpro.com.co/api/v2/"
        : "https://api-test.envia.com/",
    ),
  );
  assert.equal(options?.redirect, "error");
  const body = JSON.parse(String(options?.body));
  if (click) {
    assert.equal(
      (options?.headers as Record<string, string>).Authorization,
      process.env.ENVIOCLICK_API_KEY,
    );
    assert.ok(
      [
        "https://api.envioclickpro.com.co/api/v2/quotation",
        "https://api.envioclickpro.com.co/api/v2/shipment_sandbox",
      ].includes(String(url)),
    );
    if (String(url).endsWith("/quotation")) {
      assert.deepEqual(Object.keys(body.destination).sort(), [
        "address",
        "daneCode",
      ]);
      return Response.json({
        status: "OK",
        data: {
          rates: [
            {
              idRate: 123,
              carrier: "coordinadora",
              product: "standard",
              flete: 11000,
              minimumInsurance: 1000,
              deliveryDays: 2,
              cod: false,
            },
            {
              idRate: 124,
              carrier: "coordinadora",
              product: "contraentrega",
              flete: 100,
              minimumInsurance: 0,
              deliveryDays: 2,
              cod: true,
            },
          ],
        },
      });
    }
    generateCalls++;
    assert.equal(body.idRate, 123);
    assert.equal(body.requestPickup, false);
    assert.equal(body.insurance, false);
    assert.ok(!("codValue" in body));
    assert.equal(body.destination.address, "Dirección ficticia 123");
    if (failGenerate) throw Error("timeout");
    return Response.json({
      status: "OK",
      data: {
        idRate: 123,
        tracker: "TEST123456",
        url: "https://s3-us-west-2.amazonaws.com/envioclickpro-util/sandbox_guide.pdf",
      },
    });
  }
  if (String(url).endsWith("/ship/rate/")) {
    assert.equal(body.destination.street, "Dirección ficticia 123");
    return Response.json({
      meta: "rate",
      data: [
        {
          carrier: "coordinadora",
          service: "standard",
          totalPrice: 12000,
          currency: "COP",
          deliveryEstimate: "2 días",
        },
      ],
    });
  }
  if (String(url).endsWith("/ship/generate/")) {
    generateCalls++;
    if (failGenerate) throw Error("timeout");
    return Response.json({
      meta: "generate",
      data: [
        {
          carrier: "coordinadora",
          service: "standard",
          trackingNumber: "TEST123456",
          label: "https://files.envia.com/test.pdf",
          currency: "COP",
        },
      ],
    });
  }
  return Response.json({
    data: [{ trackingNumber: "TEST123456", status: "In transit" }],
  });
};
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
        name: click ? "Cliente Pruebas" : "Destinatario " + tag,
        email: click ? "pruebas@example.invalid" : email,
        phone: "3000000000",
        address: "Dirección ficticia 123",
        additional: "",
      },
    });
  }

  const first = await order();
  const input = {
    expectedVersion: 0,
    origin: {
      email: "pruebas@example.invalid",
      suburb: "Centro",
      crossStreet: "Calle ficticia",
      reference: "Porteria ficticia",
      name: "SJ AURUM pruebas",
      phone: "3000000000",
      street: "Calle ficticia 123",
      city: "11001000",
      state: "DC",
      postalCode: "11001000",
    },
    destination: {
      city: "11001000",
      state: "DC",
      postalCode: "11001000",
      suburb: "Centro",
      crossStreet: "Calle ficticia",
      reference: "Porteria ficticia",
    },
    carrier: "coordinadora",
    weight: click ? 1 : 0.2,
    length: 15,
    width: 10,
    height: 5,
    acceptedSandbox: true,
  };
  await check(
    "Envia exige administrador y pago aprobado antes de consultar",
    async () => {
      await assert.rejects(() => quoteEnvia(client, first.id, input));
      await assert.rejects(() => quoteEnvia(token, first.id, input), {
        code: "SHIPPING_BLOCKED",
      });
      assert.equal(calls, 0);
    },
  );
  await db.payment.create({
    data: { orderId: first.id, reference: randomUUID(), status: "APPROVED" },
  });
  await db.order.update({ where: { id: first.id }, data: { status: "PAID" } });
  await check("producción bloqueada y códigos Colombia validados", async () => {
    process.env[click ? "ENVIOCLICK_ENVIRONMENT" : "ENVIA_ENVIRONMENT"] =
      "production";
    await assert.rejects(() => quoteEnvia(token, first.id, input), {
      code: click ? "ENVIOCLICK_CLOSED" : "ENVIA_CLOSED",
    });
    process.env[click ? "ENVIOCLICK_ENVIRONMENT" : "ENVIA_ENVIRONMENT"] =
      "sandbox";
    await assert.rejects(() =>
      quoteEnvia(token, first.id, {
        ...input,
        destination: { ...input.destination, city: "Bogotá" },
      }),
    );
    assert.equal(calls, 0);
  });
  const q = await quoteEnvia(token, first.id, input);
  await check("cotización persistida y selección no manipulable", async () => {
    assert.equal(q.rates instanceof Array, true);
    if (click) {
      assert.equal((q.rates as Array<{ totalPrice: number }>).length, 1);
      assert.equal(
        (q.rates as Array<{ totalPrice: number }>)[0].totalPrice,
        12000,
      );
      process.env.SHIPPING_PROVIDER = "envia";
      await assert.rejects(
        () =>
          generateEnvia(token, first.id, {
            quoteKey: q.quoteKey,
            rateIndex: 0,
            acceptedSandbox: true,
          }),
        { code: "QUOTE_CHANGED" },
      );
      process.env.SHIPPING_PROVIDER = "envioclick";
    }
    await assert.rejects(
      () =>
        generateEnvia(token, first.id, {
          quoteKey: randomUUID(),
          rateIndex: 0,
          acceptedSandbox: true,
        }),
      { code: "QUOTE_CHANGED" },
    );
    await assert.rejects(
      () =>
        generateEnvia(token, first.id, {
          quoteKey: q.quoteKey,
          rateIndex: 4,
          acceptedSandbox: true,
        }),
      { code: "INVALID_RATE" },
    );
    assert.equal(generateCalls, 0);
  });
  await check(
    "solicitudes simultáneas crean una sola guía; no equivale a despacho",
    async () => {
      const results = await Promise.allSettled([
        generateEnvia(token, first.id, {
          quoteKey: q.quoteKey,
          rateIndex: 0,
          acceptedSandbox: true,
        }),
        generateEnvia(token, first.id, {
          quoteKey: q.quoteKey,
          rateIndex: 0,
          acceptedSandbox: true,
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(generateCalls, 1);
      const o = await db.order.findUniqueOrThrow({ where: { id: first.id } });
      assert.equal(o.shippingStatus, "PREPARING");
      assert.equal(o.trackingNumber, "TEST123456");
      await assert.rejects(
        () =>
          updateShipment(token, first.id, {
            expectedVersion: o.version,
            status: "SHIPPED",
            carrier: "Otra empresa",
            trackingNumber: "OTRA-GUIA",
            note: "Prueba de manipulación",
          }),
        { code: "ENVIA_GUIDE" },
      );
    },
  );
  await check("consulta de seguimiento y privacidad", async () => {
    if (click)
      await assert.rejects(() => trackEnvia(token, first.id), {
        code: "SANDBOX_TRACKING",
      });
    else {
      const tracking = await trackEnvia(token, first.id);
      assert.equal(tracking.providerStatus, "In transit");
    }
    const own = (await listOrders(session.id)).find((o) => o.id === first.id)!;
    assert.equal(own.enviaShipment?.provider, click ? "envioclick" : "envia");
    assert.ok(!("payload" in own.enviaShipment!));
    assert.ok(!("labelUrl" in own.enviaShipment!));
    const status = await enviaStatus(token, first.id);
    assert.ok(status.configured);
    assert.ok(!("payload" in status.shipment!));
  });
  const second = await order();
  await db.payment.create({
    data: { orderId: second.id, reference: randomUUID(), status: "APPROVED" },
  });
  await db.order.update({ where: { id: second.id }, data: { status: "PAID" } });
  const q2 = await quoteEnvia(token, second.id, input);
  await check(
    "fallo ambiguo bloquea reintentos y mantiene solicitud consultable",
    async () => {
      failGenerate = true;
      await assert.rejects(
        () =>
          generateEnvia(token, second.id, {
            quoteKey: q2.quoteKey,
            rateIndex: 0,
            acceptedSandbox: true,
          }),
        { code: "ENVIA_UNKNOWN" },
      );
      assert.equal(
        (await enviaStatus(token, second.id)).shipment?.state,
        "UNKNOWN",
      );
      await assert.rejects(
        () =>
          generateEnvia(token, second.id, {
            quoteKey: q2.quoteKey,
            rateIndex: 0,
            acceptedSandbox: true,
          }),
        { code: "ENVIA_EXISTS" },
      );
      assert.equal(generateCalls, 2);
      if (click) {
        process.env.SHIPPING_PROVIDER = "envia";
        await assert.rejects(
          () => quoteEnvia(token, second.id, { ...input, expectedVersion: 1 }),
          { code: "ENVIA_EXISTS" },
        );
        process.env.SHIPPING_PROVIDER = "envioclick";
      }
    },
  );
  console.log(
    count +
      " grupos " +
      (click ? "Envíoclick" : "Envia") +
      " aprobados con proveedor simulado.",
  );
} finally {
  globalThis.fetch = originalFetch;
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await db.$disconnect();
}
