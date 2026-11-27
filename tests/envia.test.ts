import test from "node:test";
import assert from "node:assert/strict";
import {
  enviaConfig,
  enviaRequest,
  parseRates,
  parseLabel,
  safeLabelUrl,
} from "../src/modules/shipping/envia";
process.env.APP_ENV = "development";
process.env.ENVIA_ENVIRONMENT = "sandbox";
process.env.ENVIA_API_TOKEN = "sandbox-fixture-not-a-real-token";
test("Envia restricts environments and keeps tokens on server", async () => {
  process.env.ENVIA_ENVIRONMENT = "production";
  assert.throws(enviaConfig, { code: "ENVIA_CLOSED" });
  process.env.ENVIA_ENVIRONMENT = "sandbox";
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api-test.envia.com/ship/rate/");
      assert.equal(init?.redirect, "error");
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        "Bearer sandbox-fixture-not-a-real-token",
      );
      return new Response("credential contents must not appear", {
        status: 401,
      });
    };
    await assert.rejects(
      () => enviaRequest("/ship/rate/", {}),
      (e: unknown) =>
        e instanceof Error &&
        !e.message.includes("credential contents") &&
        !e.message.includes(process.env.ENVIA_API_TOKEN!),
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("Envia filters foreign currencies and unsafe label URLs", () => {
  assert.throws(
    () =>
      parseRates({
        meta: "rate",
        data: [{ carrier: "x", service: "y", totalPrice: 2, currency: "USD" }],
      }),
    { code: "ENVIA_NO_RATES" },
  );
  assert.equal(
    parseRates({
      meta: "rate",
      data: [
        {
          carrier: "coordinadora",
          service: "standard",
          totalPrice: 10000,
          currency: "COP",
        },
      ],
    }).length,
    1,
  );
  for (const url of [
    "javascript:alert(1)",
    "http://files.envia.com/a",
    "https://envia.com.evil.invalid/a",
    "https://user:pass@files.envia.com/a",
  ])
    assert.equal(safeLabelUrl(url), "");
  assert.equal(
    safeLabelUrl("https://files.envia.com/a.pdf"),
    "https://files.envia.com/a.pdf",
  );
  assert.throws(() => parseLabel({ meta: "generate", data: [] }));
});
