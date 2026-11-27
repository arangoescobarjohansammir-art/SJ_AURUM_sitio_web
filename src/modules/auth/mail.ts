import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { requireDevelopmentAccounts, issueToken } from "./service";
export async function deliverLocalToken(
  email: unknown,
  kind: "VERIFY" | "RESET",
) {
  requireDevelopmentAccounts();
  const delivery = await issueToken(email, kind);
  if (!delivery) return;
  const base = new URL(process.env.APP_URL ?? "http://127.0.0.1:3000");
  if (!["127.0.0.1", "localhost"].includes(base.hostname))
    throw Error("Local mailbox requires loopback APP_URL");
  const url = new URL("/cuenta/enlace", base);
  // Fragment stays out of HTTP access logs and referrer headers.
  url.hash = new URLSearchParams({ kind, token: delivery.token }).toString();
  // Runtime configuration prevents the bundler from tracing mutable local data.
  const dir = process.env.LOCAL_MAIL_DIRECTORY;
  if (!dir) throw Error("LOCAL_MAIL_DIRECTORY is required for local delivery");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, randomUUID() + ".json"),
    JSON.stringify(
      {
        to: delivery.email,
        kind,
        url: url.toString(),
        expiresInMinutes: 30,
        notice: "Solo desarrollo. No se ha enviado ningún correo.",
      },
      null,
      2,
    ),
    { flag: "wx", mode: 0o600 },
  );
}
