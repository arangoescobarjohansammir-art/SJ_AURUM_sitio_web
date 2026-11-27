import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/lib/db";
import { issueToken, consumeToken } from "../src/modules/auth/service";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
const dbUrl = new URL(process.env.DATABASE_URL ?? "");
if (
  dbUrl.hostname !== "127.0.0.1" ||
  dbUrl.port !== "55432" ||
  dbUrl.pathname !== "/aurum_dev" ||
  process.env.APP_ENV !== "development"
)
  throw Error("Solo desarrollo local");
const origin = "http://127.0.0.1:3000",
  tag = randomUUID(),
  email = "admin-http-" + tag + "@example.invalid",
  password = "Prueba exclusiva " + randomUUID();
const jar = new Map<string, string>();
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  badOrigin = false,
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Origin: badOrigin ? "https://untrusted.invalid" : origin,
      "Content-Type": "application/json",
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join(";"),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0],
      i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return { status: response.status, data: await response.json() };
}
try {
  for (const path of ["/api/admin/orders", "/api/admin/orders/unknown"]) {
    assert.equal((await call(path)).status, 401);
  }
  assert.equal(
    (
      await call("/api/auth/register", "POST", {
        name: "Operador HTTP pedidos",
        email,
        password,
        acceptedDemo: true,
      })
    ).status,
    202,
  );
  await call("/api/auth/login", "POST", { email, password });
  assert.equal((await call("/api/admin/orders")).status, 403);
  assert.equal(
    (await call("/api/admin/orders/unknown", "PATCH", {})).status,
    403,
  );
  const link = await issueToken(email, "VERIFY");
  assert.ok(link);
  await consumeToken({ token: link.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  await call("/api/auth/login", "POST", { email, password });
  assert.equal((await call("/api/admin/orders?page=0")).status, 400);
  assert.equal((await call("/api/admin/orders/unknown")).status, 404);
  assert.equal(
    (await call("/api/admin/orders/unknown", "PATCH", {}, true)).status,
    403,
  );
  assert.equal(
    (await call("/api/admin/orders/unknown", "PATCH", {})).status,
    400,
  );
  const { setCartQuantity, quoteCart, createOrder, cancelOrder } =
    await import("../src/modules/commerce/service");
  const db = getDb(),
    session = await db.visitorSession.create({
      data: {
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
  await db.product.create({
    data: {
      id: tag,
      slug: tag,
      name: "Pieza HTTP pedidos",
      category: "Cadenas",
      description: "Producto aislado de prueba",
      image: "/images/product-1.jpg",
      gallery: [],
      active: true,
      variants: {
        create: { id: tag, sku: tag, label: "45 cm", price: 90000, stock: 2 },
      },
    },
  });
  const variant = { id: tag };
  const rate = await db.shippingRate.create({
    data: { id: tag, department: tag, city: tag, amount: 12000, active: true },
  });
  await setCartQuantity(session.id, { variantId: variant.id, quantity: 1 });
  const q = await quoteCart(session.id, {
    shippingRateId: rate.id,
    coupon: "",
  });
  const o = await createOrder(session.id, {
    shippingRateId: rate.id,
    coupon: "",
    quoteHash: q.quoteHash,
    idempotencyKey: randomUUID(),
    acceptedDemo: true,
    recipient: {
      name: "Pedido HTTP de ejemplo",
      email,
      phone: "3000000000",
      address: "Dirección ficticia 123",
      additional: "",
    },
  });
  try {
    const path = "/api/admin/orders/" + o.id;
    const found = await call(
      "/api/admin/orders?query=" + encodeURIComponent(email),
    );
    assert.equal(found.data.total, 1);
    assert.ok(!("recipient" in found.data.orders[0]));
    assert.equal((await call(path)).data.order.id, o.id);
    const note = {
      action: "FOLLOW_UP",
      followUp: "REVIEWED",
      reason: "Revisión HTTP de ejemplo",
      expectedVersion: 0,
    };
    assert.equal((await call(path, "PATCH", note)).status, 200);
    assert.equal((await call(path, "PATCH", note)).status, 409);
    assert.equal(
      (
        await call(path, "PATCH", {
          action: "CANCEL",
          reason: "Cancelación HTTP de prueba",
          expectedVersion: 1,
        })
      ).status,
      200,
    );
    const detail = await call(path);
    assert.equal(detail.data.history.length, 2);
    assert.equal(detail.data.order.status, "CANCELLED");
    assert.ok(!("sessionId" in detail.data.order));
  } finally {
    await cancelOrder(session.id, o.id);
  }
  await changeDevelopmentRole(email, "revoke");
  assert.equal((await call("/api/admin/orders")).status, 401);
  console.log(
    "PASS HTTP pedidos: permisos, origen, validación, búsqueda, detalle, notas, conflicto, cancelación y revocación.",
  );
} finally {
  await getDb().product.updateMany({
    where: { id: tag },
    data: { active: false },
  });
  await getDb().shippingRate.updateMany({
    where: { id: tag },
    data: { active: false },
  });
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await getDb().$disconnect();
}
