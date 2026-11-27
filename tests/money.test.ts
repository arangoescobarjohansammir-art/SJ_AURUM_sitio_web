import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCOP, toPaymentCents } from "../src/lib/money";

test("COP is displayed in pesos and converted once to provider cents", () => {
  assert.match(formatCOP(145000), /145\.000/);
  assert.equal(toPaymentCents(145000), 14500000);
});
test("reject invalid amounts before payment", () => {
  for (const value of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => toPaymentCents(value), RangeError);
  }
});
