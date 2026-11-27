import test from "node:test";
import assert from "node:assert/strict";
import { createWebhookRelay } from "../scripts/webhook-relay";
test("public relay rejects admin, query paths, invalid type and oversized body", async () => {
  const server = createWebhookRelay();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (const path of [
      "/admin",
      "/api/account",
      "/",
      "/api/payments/wompi/events?x=1",
    ]) {
      assert.equal((await fetch(origin + path)).status, 404);
    }
    const endpoint = origin + "/api/payments/wompi/events";
    assert.equal(
      (await fetch(endpoint, { method: "POST", body: "{}" })).status,
      415,
    );
    assert.equal(
      (
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "x".repeat(17000),
        })
      ).status,
      413,
    );
    assert.equal(
      (
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid",
        })
      ).status,
      400,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
