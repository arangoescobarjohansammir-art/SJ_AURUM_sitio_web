import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/lib/db";
import { register, consumeToken, login } from "../src/modules/auth/service";
import { deliverLocalToken } from "../src/modules/auth/mail";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo base local");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.toString();
process.env.APP_ENV = "development";
process.env.MAIL_PROVIDER = "resend";
process.env.RESEND_API_KEY = "re_fixture_mail";
const email = "mail-auth-" + randomUUID() + "@example.invalid";
process.env.MAIL_ALLOWED_RECIPIENTS = email;
process.env.MAIL_APP_URL = "http://127.0.0.1:3000";
const original = globalThis.fetch;
let calls = 0,
  body: { text: string; html: string; to: string[] };
globalThis.fetch = async (_url, init) => {
  calls++;
  body = JSON.parse(String(init?.body));
  return Response.json({ id: randomUUID() });
};
const readToken = () => {
  const link = body.text
    .split(/\s/)
    .find((s) => s.startsWith("http://127.0.0.1:3000/cuenta/enlace#"))!;
  return new URLSearchParams(new URL(link).hash.slice(1)).get("token")!;
};
try {
  const password = "Prueba inicial " + randomUUID();
  await register({
    name: "Cliente correo",
    email,
    password,
    acceptedDemo: true,
  });
  await deliverLocalToken(email, "VERIFY");
  assert.equal(calls, 1);
  assert.deepEqual(body!.to, [email]);
  const verify = readToken();
  await consumeToken({ token: verify }, "VERIFY");
  await assert.rejects(() => consumeToken({ token: verify }, "VERIFY"));
  await deliverLocalToken(email, "VERIFY");
  assert.equal(calls, 1);
  await deliverLocalToken(email, "RESET");
  const reset = readToken();
  const next = "Nueva contraseña " + randomUUID();
  await consumeToken({ token: reset, password: next }, "RESET");
  await assert.rejects(() => login({ email, password }));
  assert.ok((await login({ email, password: next })).token);
  await assert.rejects(() =>
    consumeToken({ token: reset, password: next }, "RESET"),
  );
  await deliverLocalToken("other@example.invalid", "RESET");
  assert.equal(calls, 2);
  console.log(
    "PASS correo: verificación, recuperación, un solo uso, destinatario y aislamiento con proveedor simulado",
  );
} finally {
  globalThis.fetch = original;
  await getDb().$disconnect();
}
