import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/lib/db";
import { queueOrderMail, processMailBatch } from "../src/modules/mail/outbox";
import { sendMail } from "../src/modules/mail/transport";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo base local");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.toString();
process.env.APP_ENV = "development";
process.env.MAIL_PROVIDER = "resend";
process.env.RESEND_API_KEY = "re_fixture_not_real";
process.env.MAIL_ALLOWED_RECIPIENTS = "mail@example.invalid";
process.env.MAIL_FROM = "SJ AURUM <onboarding@resend.dev>";
if (
  spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, stdio: "inherit", windowsHide: true },
  ).status !== 0
)
  throw Error("Migration failed");
const db = getDb(),
  tag = randomUUID(),
  original = globalThis.fetch;
let count = 0;
const calls: { key: string; body: string }[] = [];
let status = 200;
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://api.resend.com/emails");
  calls.push({
    key: (init?.headers as Record<string, string>)["Idempotency-Key"],
    body: String(init?.body),
  });
  return Response.json(
    status === 200 ? { id: randomUUID() } : { error: "do not expose" },
    { status },
  );
};
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log("PASS " + name);
  count++;
}
try {
  // This isolated test database has no live delivery. Complete unrelated fixtures locally.
  await db.mailOutbox.updateMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "FAILED", lastError: "TEST_ISOLATION" },
  });
  const session = await db.visitorSession.create({
    data: {
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  const order = await db.order.create({
    data: {
      number: "MAIL-" + tag,
      sessionId: session.id,
      idempotencyKey: randomUUID(),
      requestHash: tag,
      subtotal: 10000,
      shipping: 1000,
      discount: 0,
      total: 11000,
      recipient: { email: "mail@example.invalid" },
      shippingLabel: "Bogotá",
      expiresAt: new Date(Date.now() + 900000),
    },
  });
  const enqueue = (event: string) =>
    db.$transaction((tx) =>
      queueOrderMail(tx, order.id, tag + event, "Pedido de prueba recibido"),
    );
  await check("evento y pedido son atómicos, sin duplicados", async () => {
    await assert.rejects(() =>
      db.$transaction(async (tx) => {
        await queueOrderMail(tx, order.id, tag + "rollback", "Prueba");
        throw Error("rollback");
      }),
    );
    assert.equal(
      await db.mailOutbox.count({ where: { eventKey: tag + "rollback" } }),
      0,
    );
    await enqueue("created");
    await enqueue("created");
    assert.equal(
      await db.mailOutbox.count({ where: { eventKey: tag + "created" } }),
      1,
    );
  });
  await check(
    "trabajadores concurrentes envían una vez y conservan resultado",
    async () => {
      await Promise.all([processMailBatch(), processMailBatch()]);
      assert.equal(calls.length, 1);
      assert.equal(
        (
          await db.mailOutbox.findUniqueOrThrow({
            where: { eventKey: tag + "created" },
          })
        ).status,
        "SENT",
      );
      await processMailBatch();
      assert.equal(calls.length, 1);
    },
  );
  await check(
    "fallo temporal reintenta con misma clave y contenido",
    async () => {
      await enqueue("retry");
      status = 503;
      await processMailBatch();
      let row = await db.mailOutbox.findUniqueOrThrow({
        where: { eventKey: tag + "retry" },
      });
      assert.equal(row.status, "PENDING");
      assert.equal(row.lastError, "MAIL_HTTP_503");
      await db.mailOutbox.update({
        where: { id: row.id },
        data: { nextAttemptAt: new Date(0) },
      });
      status = 200;
      await processMailBatch();
      assert.deepEqual(calls[1], calls[2]);
    },
  );
  await check(
    "rechazo permanente y límite de idempotencia no reenvían",
    async () => {
      await enqueue("deny");
      status = 403;
      await processMailBatch();
      assert.equal(
        (
          await db.mailOutbox.findUniqueOrThrow({
            where: { eventKey: tag + "deny" },
          })
        ).status,
        "FAILED",
      );
      await enqueue("old");
      await db.mailOutbox.update({
        where: { eventKey: tag + "old" },
        data: { firstAttemptAt: new Date(Date.now() - 24 * 3600000) },
      });
      const before = calls.length;
      await processMailBatch();
      assert.equal(calls.length, before);
    },
  );
  await check(
    "destinatarios ajenos bloqueados sin contacto externo",
    async () => {
      const before = calls.length;
      await assert.rejects(
        () =>
          sendMail(
            {
              to: "other@example.invalid",
              from: "SJ AURUM <onboarding@resend.dev>",
              subject: "test",
              text: "test",
              html: "test",
            },
            "test-block",
          ),
        { code: "MAIL_RECIPIENT_BLOCKED" },
      );
      assert.equal(calls.length, before);
    },
  );
  console.log(count + " grupos de correo aprobados con proveedor simulado.");
} finally {
  globalThis.fetch = original;
  await db.$disconnect();
}
