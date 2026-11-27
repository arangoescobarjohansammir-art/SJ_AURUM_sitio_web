import test from "node:test";
import assert from "node:assert/strict";
import { template } from "../src/modules/mail/templates";
import { mailOrigin } from "../src/modules/mail/transport";
test("mail templates escape HTML and preserve text links", () => {
  const result = template(
    "Hola <script>",
    ["<img src=x onerror=alert(1)>"],
    "https://example.com/cuenta#token=abc&kind=VERIFY",
    "Entrar",
  );
  assert.ok(!result.html.includes("<script>"));
  assert.ok(!result.html.includes("<img"));
  assert.ok(result.html.includes("&amp;kind"));
  assert.ok(result.text.includes("#token=abc&kind=VERIFY"));
});
test("mail links reject credential-bearing or insecure external origins", () => {
  process.env.APP_ENV = "development";
  for (const value of [
    "http://example.com",
    "https://user:pass@example.com",
    "javascript:alert(1)",
  ]) {
    process.env.MAIL_APP_URL = value;
    assert.throws(mailOrigin);
  }
  process.env.MAIL_APP_URL = "http://127.0.0.1:3000";
  assert.equal(mailOrigin(), "http://127.0.0.1:3000");
  process.env.MAIL_APP_URL = "https://shop.example.com/path";
  assert.equal(mailOrigin(), "https://shop.example.com");
});
