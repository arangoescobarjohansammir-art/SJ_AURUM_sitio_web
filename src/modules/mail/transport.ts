import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
export class MailError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function mailMode() {
  const mode = process.env.MAIL_PROVIDER ?? "local";
  if (!["local", "resend"].includes(mode))
    throw new MailError("MAIL_CONFIGURATION");
  return mode;
}
export function mailOrigin() {
  const url = new URL(
    process.env.MAIL_APP_URL || process.env.APP_URL || "http://127.0.0.1:3000",
  );
  if (
    url.username ||
    url.password ||
    !(
      url.protocol === "https:" ||
      (process.env.APP_ENV === "development" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new MailError("MAIL_LINK_ORIGIN");
  return url.origin;
}
export function allowedRecipient(to: string) {
  return (process.env.MAIL_ALLOWED_RECIPIENTS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(to.toLowerCase());
}
export function sender() {
  return process.env.MAIL_FROM || "SJ AURUM <onboarding@resend.dev>";
}
export type MailMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
};
export async function sendMail(
  message: MailMessage,
  key: string,
  mode = mailMode(),
) {
  if (!/^[a-zA-Z0-9:_-]{1,200}$/.test(key)) throw new MailError("MAIL_KEY");
  z.email().parse(message.to);
  if (mode === "local") {
    const dir = process.env.LOCAL_MAIL_DIRECTORY;
    if (!dir) throw new MailError("MAIL_CONFIGURATION");
    await mkdir(dir, { recursive: true });
    try {
      await writeFile(
        join(dir, key.replaceAll(":", "-") + ".json"),
        JSON.stringify({
          ...message,
          kind: "ORDER",
          notice: "Bandeja local; no se envió correo real.",
        }),
        { flag: "wx", mode: 0o600 },
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    return { id: "local:" + key };
  }
  if (
    mode !== "resend" ||
    !process.env.RESEND_API_KEY?.startsWith("re_") ||
    !message.from ||
    /[\r\n]/.test(message.from)
  )
    throw new MailError("MAIL_CONFIGURATION");
  // Development sends only to explicitly configured test recipients. Never redirect account links.
  if (process.env.APP_ENV !== "development" || !allowedRecipient(message.to))
    throw new MailError("MAIL_RECIPIENT_BLOCKED");
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
  } catch {
    throw new MailError("MAIL_NETWORK");
  }
  if (!response.ok) throw new MailError("MAIL_HTTP_" + response.status);
  try {
    return z
      .object({ id: z.string().min(1).max(100) })
      .parse(await response.json());
  } catch {
    throw new MailError("MAIL_RESPONSE");
  }
}
