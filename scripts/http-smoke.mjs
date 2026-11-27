import assert from "node:assert/strict";
const origin = "http://127.0.0.1:3000";
const call = (path, options = {}) => fetch(origin + path, options);
const json = { "Content-Type": "application/json", Origin: origin };
assert.equal((await call("/api/orders")).status, 401);
assert.equal(
  (
    await call("/api/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://other.invalid",
      },
      body: "{}",
    })
  ).status,
  403,
);
const session = await call("/api/session", {
  method: "POST",
  headers: json,
  body: "{}",
});
assert.equal(session.status, 200);
const cookie = session.headers.get("set-cookie");
assert.ok(cookie?.includes("HttpOnly") && cookie.includes("SameSite=strict"));
const headers = { ...json, Cookie: cookie.split(";")[0] };
assert.equal(
  (
    await call("/api/cart", {
      method: "PUT",
      headers,
      body: JSON.stringify({ variantId: "invalid", quantity: -1 }),
    })
  ).status,
  400,
);
assert.equal(
  (
    await call("/api/cart", {
      method: "PUT",
      headers,
      body: JSON.stringify({ text: "x".repeat(17000) }),
    })
  ).status,
  413,
);
const orders = await call("/api/orders", { headers });
assert.equal(orders.status, 200);
assert.equal(orders.headers.get("cache-control"), "no-store");
assert.deepEqual((await orders.json()).orders, []);
console.log(
  "PASS HTTP: sesión requerida, origen externo rechazado, cookie HttpOnly/SameSite, validación, límite de cuerpo y pedidos privados.",
);
