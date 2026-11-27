import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  mailMode,
  mailOrigin,
  sendMail,
  sender,
  allowedRecipient,
} from "../mail/transport";
import { template } from "../mail/templates";
import { tokenHash } from "./password";
import { requireDevelopmentAccounts, issueToken } from "./service";
export async function deliverLocalToken(
  email: unknown,
  kind: "VERIFY" | "RESET",
) {
  requireDevelopmentAccounts();
  const mode = mailMode();
  if (
    mode === "resend" &&
    (typeof email !== "string" || !allowedRecipient(email.trim().toLowerCase()))
  )
    return;
  const delivery = await issueToken(email, kind);
  if (!delivery) return;
  const base = new URL(mailOrigin());
  if (mode === "local" && !["127.0.0.1", "localhost"].includes(base.hostname))
    throw Error("Local mailbox requires loopback APP_URL");
  const url = new URL("/cuenta/enlace", base);
  // Fragment stays out of HTTP access logs and referrer headers.
  url.hash = new URLSearchParams({ kind, token: delivery.token }).toString();
  if (mode === "resend") {
    const title =
      kind === "VERIFY" ? "Verifica tu correo" : "Recupera tu contraseña";
    await sendMail(
      {
        to: delivery.email,
        from: sender(),
        ...template(
          title,
          [
            "Solicitaste este enlace en SJ AURUM. Vence en 30 minutos y solo se puede usar una vez.",
            "Si no hiciste esta solicitud, puedes ignorar este mensaje.",
          ],
          url.toString(),
          kind === "VERIFY" ? "Verificar correo" : "Cambiar contraseña",
        ),
      },
      "account:" + tokenHash(delivery.token),
      mode,
    );
    return;
  }
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
