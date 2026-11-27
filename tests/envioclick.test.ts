import test from "node:test";
import assert from "node:assert/strict";
import {
  clickLabel,
  safeClickLabelUrl,
  envioclickRequest,
} from "../src/modules/shipping/envioclick";
test("Envíoclick rechaza enlaces ajenos y respuestas de otra tarifa", () => {
  const url =
    "https://s3-us-west-2.amazonaws.com/envioclickpro-util/sandbox_guide.pdf";
  assert.equal(safeClickLabelUrl(url), url);
  for (const bad of [
    "http://s3-us-west-2.amazonaws.com/envioclickpro-util/sandbox_guide.pdf",
    url + "?redirect=evil",
    "https://s3-us-west-2.amazonaws.com/otro/guia.pdf",
    "https://evil.test/guia.pdf",
  ])
    assert.equal(safeClickLabelUrl(bad), "");
  assert.throws(() =>
    clickLabel(
      { status: "OK", data: { idRate: 2, tracker: "TEST123", url } },
      {
        idRate: 1,
        carrier: "Test",
        service: "Normal",
        totalPrice: 1,
        currency: "COP",
        deliveryEstimate: "2 días",
      },
    ),
  );
});
test("Endpoint productivo bloqueado incluso con argumento manipulado", async () => {
  await assert.rejects(
    () => envioclickRequest("/shipment" as "/shipment_sandbox", {}),
    /Endpoint bloqueado/,
  );
});
