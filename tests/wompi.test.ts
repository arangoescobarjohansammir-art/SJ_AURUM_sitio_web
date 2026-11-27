import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  checkoutUrl,
  checkoutWidget,
  verifyEvent,
  paymentConfig,
} from "../src/modules/payments/wompi";
process.env.APP_ENV = "development";
process.env.WOMPI_ENVIRONMENT = "sandbox";
process.env.WOMPI_PUBLIC_KEY = "pub_test_fixture";
process.env.WOMPI_PRIVATE_KEY = "prv_test_fixture";
process.env.WOMPI_EVENTS_SECRET = "test_events_fixture";
process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_fixture";
test("checkout signs amount, currency, expiration and reference without exposing secrets", () => {
  const expiration = new Date("2027-01-01T00:00:00.000Z");
  const url = new URL(checkoutUrl("example", 1234, expiration));
  assert.equal(url.searchParams.get("amount-in-cents"), "123400");
  assert.equal(
    url.searchParams.get("signature:integrity"),
    createHash("sha256")
      .update(
        "example123400COP" +
          expiration.toISOString() +
          "test_integrity_fixture",
      )
      .digest("hex"),
  );
  assert.ok(!url.href.includes("prv_test"));
  assert.ok(!url.href.includes("test_integrity"));
  const widget = checkoutWidget("example", 1234, expiration);
  assert.equal(
    widget.signature.integrity,
    url.searchParams.get("signature:integrity"),
  );
  assert.equal(widget.bootstrapTransport, "postmessage");
  assert.equal(widget.amountInCents, 123400);
  assert.ok(!("redirectUrl" in widget));
});
test("dynamic event signature, tampering and production rejection", () => {
  const transaction = {
    id: "test-123",
    status: "APPROVED",
    amount_in_cents: 10000,
    reference: "ref",
    currency: "COP",
  };
  const checksum = createHash("sha256")
    .update("10000test-123APPROVED123test_events_fixture")
    .digest("hex");
  const event = {
    event: "transaction.updated",
    environment: "test",
    timestamp: 123,
    data: { transaction },
    signature: {
      properties: [
        "transaction.amount_in_cents",
        "transaction.id",
        "transaction.status",
      ],
      checksum,
    },
  };
  assert.equal(verifyEvent(event), "test-123");
  assert.throws(() => verifyEvent({ ...event, environment: "prod" }));
  assert.throws(() =>
    verifyEvent({
      ...event,
      data: { transaction: { ...transaction, status: "DECLINED" } },
    }),
  );
  assert.throws(() =>
    verifyEvent({
      ...event,
      signature: { ...event.signature, properties: ["__proto__.id"] },
    }),
  );
  process.env.WOMPI_PUBLIC_KEY = "pub_prod_fixture";
  assert.throws(paymentConfig);
  process.env.WOMPI_PUBLIC_KEY = "pub_test_fixture";
});
