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
  assert.equal((await call("/api/admin/products")).status, 401);
  assert.equal((await call("/api/admin/products", "POST", {})).status, 401);
  assert.equal(
    (
      await call("/api/auth/register", "POST", {
        name: "Administrador HTTP",
        email,
        password,
        acceptedDemo: true,
      })
    ).status,
    202,
  );
  assert.equal(
    (await call("/api/auth/login", "POST", { email, password })).status,
    200,
  );
  for (const [path, method] of [
    ["/api/admin/products", "GET"],
    ["/api/admin/products", "POST"],
    ["/api/admin/products/unknown", "PATCH"],
    ["/api/admin/products/unknown/variants", "POST"],
    ["/api/admin/variants/unknown", "PATCH"],
    ["/api/admin/variants/unknown/stock", "POST"],
  ]) {
    assert.equal(
      (await call(path, method, method === "GET" ? undefined : {})).status,
      403,
    );
  }
  const link = await issueToken(email, "VERIFY");
  assert.ok(link);
  await consumeToken({ token: link.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  assert.equal((await call("/api/admin/products")).status, 401);
  assert.equal(
    (await call("/api/auth/login", "POST", { email, password })).status,
    200,
  );
  assert.equal(
    (await call("/api/admin/products", "POST", {}, true)).status,
    403,
  );
  assert.equal((await call("/api/admin/products", "POST", {})).status, 400);
  const product = {
    name: "Producto HTTP de ejemplo",
    slug: "http-" + tag,
    category: "Anillos",
    description: "Referencia de prueba para verificar el panel.",
    image: "/images/product-5.jpg",
    gallery: ["/images/product-5.jpg"],
    active: false,
  };
  const variant = {
      sku: "HTTP_" + tag.toUpperCase(),
      label: "Talla de prueba",
      price: 78000,
      active: true,
    },
    reason = "Validación por HTTP de administración";
  const created = await call("/api/admin/products", "POST", {
    product,
    variant,
    reason,
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  let detail = await call("/api/admin/products/" + id);
  assert.equal(detail.status, 200);
  const v = detail.data.product.variants[0];
  assert.equal(
    (
      await call("/api/admin/variants/" + v.id + "/stock", "POST", {
        stock: 7,
        expectedVersion: v.version,
        reason,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/admin/variants/" + v.id + "/stock", "POST", {
        stock: 9,
        expectedVersion: v.version,
        reason,
      })
    ).status,
    409,
  );
  detail = await call("/api/admin/products/" + id);
  assert.equal(detail.data.product.variants[0].stock, 7);
  assert.equal(detail.data.audits.length, 3);
  assert.equal(
    (await call("/api/admin/products?query=" + encodeURIComponent(variant.sku)))
      .data.total,
    1,
  );
  await changeDevelopmentRole(email, "revoke");
  assert.equal((await call("/api/admin/products")).status, 401);
  console.log(
    "PASS HTTP administración: acceso por rol, sesión revocada, origen, validación, creación, inventario, conflicto y auditoría.",
  );
} finally {
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await getDb().$disconnect();
}
