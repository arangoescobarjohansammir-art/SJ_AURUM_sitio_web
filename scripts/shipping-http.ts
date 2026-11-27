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
  assert.equal((await call("/api/admin/orders/unknown/envia")).status, 401);
  assert.equal(
    (await call("/api/admin/orders/unknown/envia", "POST", { action: "QUOTE" }))
      .status,
    401,
  );
  assert.equal(
    (await call("/api/admin/orders/unknown/envia", "POST", {}, true)).status,
    403,
  );
  assert.equal((await call("/api/admin/shipping")).status, 401);
  for (const path of [
    "/api/admin/shipping",
    "/api/admin/orders/unknown/shipping",
  ]) {
    assert.equal((await call(path, "POST", {})).status, 401);
    assert.equal((await call(path, "POST", {}, true)).status, 403);
  }
  assert.equal(
    (
      await call("/api/auth/register", "POST", {
        name: "Operador envíos HTTP",
        email,
        password,
        acceptedDemo: true,
      })
    ).status,
    202,
  );
  await call("/api/auth/login", "POST", { email, password });
  assert.equal((await call("/api/admin/shipping")).status, 403);
  assert.equal((await call("/api/admin/orders/unknown/envia")).status, 403);
  const link = await issueToken(email, "VERIFY");
  assert.ok(link);
  await consumeToken({ token: link.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  await call("/api/auth/login", "POST", { email, password });
  assert.equal((await call("/api/admin/shipping")).status, 200);
  assert.equal((await call("/api/admin/orders/unknown/envia")).status, 404);
  assert.equal(
    (
      await call("/api/admin/orders/unknown/envia", "POST", {
        action: "INVALID",
      })
    ).status,
    400,
  );
  assert.equal((await call("/api/admin/shipping", "POST", {})).status, 400);
  assert.equal(
    (await call("/api/admin/orders/unknown/shipping", "POST", {})).status,
    400,
  );
  const rates = await call("/api/shipping");
  assert.equal(rates.status, 200);
  assert.ok(
    rates.data.rates.every(
      (r: { carrier: string; minDays: number }) => r.carrier && r.minDays >= 1,
    ),
  );
  const page = await fetch(origin + "/admin/envios", {
    headers: { Cookie: [...jar].map(([k, v]) => k + "=" + v).join(";") },
  });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes("Nuevo destino"));
  assert.ok(html.includes("Tarifa en COP"));
  console.log(
    "PASS HTTP envíos: permisos, origen, validación, tarifas públicas y página administrativa",
  );
} finally {
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await getDb().$disconnect();
}
