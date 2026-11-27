import "dotenv/config";
import assert from "node:assert/strict";
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw Error("Solo servidor local");
async function post(path: string, body: unknown, origin = base) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}
assert.equal(
  (await post("/api/orders/unknown/payment", {}, "https://example.invalid"))
    .status,
  403,
);
assert.equal((await post("/api/orders/unknown/payment", {})).status, 401);
assert.equal((await post("/api/payments/sync", { id: "unknown" })).status, 401);
assert.equal(
  (
    await post("/api/admin/orders/unknown/refund", {
      reason: "Prueba de seguridad",
    })
  ).status,
  401,
);
const event = {
  event: "transaction.updated",
  environment: "test",
  timestamp: 123,
  data: {
    transaction: {
      id: "unknown",
      reference: "unknown",
      status: "APPROVED",
      amount_in_cents: 100,
      currency: "COP",
    },
  },
  signature: { properties: ["transaction.id"], checksum: "0".repeat(64) },
};
assert.equal((await post("/api/payments/wompi/events", event)).status, 401);
assert.equal(
  (await post("/api/payments/wompi/events", { ...event, environment: "prod" }))
    .status,
  400,
);
assert.equal((await post("/api/payments/wompi/events", {})).status, 400);
console.log(
  "PASS HTTP pagos: origen, sesión, administrador, firma inválida y ambiente incorrecto.",
);
