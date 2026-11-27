import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CommerceError } from "../commerce/service";
import { toPaymentCents } from "../../lib/money";

const closed = () =>
  new CommerceError(
    "PAYMENTS_CLOSED",
    "Wompi Sandbox no está configurado. Los cobros reales están deshabilitados.",
    503,
  );
export function paymentConfig() {
  const publicKey = process.env.WOMPI_PUBLIC_KEY ?? "";
  const privateKey = process.env.WOMPI_PRIVATE_KEY ?? "";
  const integrity = process.env.WOMPI_INTEGRITY_SECRET ?? "";
  const events = process.env.WOMPI_EVENTS_SECRET ?? "";
  if (
    process.env.APP_ENV !== "development" ||
    process.env.WOMPI_ENVIRONMENT !== "sandbox" ||
    !publicKey.startsWith("pub_test_") ||
    !privateKey.startsWith("prv_test_") ||
    !integrity.startsWith("test_integrity_") ||
    !events.startsWith("test_events_")
  )
    throw closed();
  const appUrl = new URL(process.env.APP_URL ?? "http://127.0.0.1:3000");
  return { publicKey, privateKey, integrity, events, appUrl };
}
export function paymentsEnabled() {
  try {
    paymentConfig();
    return true;
  } catch {
    return false;
  }
}
export function checkoutUrl(reference: string, total: number, expiresAt: Date) {
  const config = paymentConfig();
  const amount = toPaymentCents(total).toString(),
    expiration = expiresAt.toISOString();
  const signature = createHash("sha256")
    .update(reference + amount + "COP" + expiration + config.integrity)
    .digest("hex");
  const url = new URL("https://checkout.wompi.co/p/");
  url.search = new URLSearchParams({
    "public-key": config.publicKey,
    currency: "COP",
    "amount-in-cents": amount,
    reference,
    "signature:integrity": signature,
    "expiration-time": expiration,
    "redirect-url": new URL("/pagos/resultado", config.appUrl).href,
  }).toString();
  return url.href;
}
export const transactionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  reference: z.string().max(200),
  amount_in_cents: z.number().int().positive(),
  currency: z.literal("COP"),
  status: z.enum(["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"]),
});
export type WompiTransaction = z.infer<typeof transactionSchema>;
export async function wompiRequest(
  path: string,
  body?: unknown,
): Promise<unknown> {
  const config = paymentConfig();
  try {
    const result = await fetch("https://sandbox.wompi.co/v1/" + path, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${config.privateKey}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12000),
    });
    if (!result.ok) throw Error("Provider unavailable");
    return await result.json();
  } catch {
    throw new CommerceError(
      "WOMPI_UNAVAILABLE",
      "No pudimos confirmar la respuesta de Wompi. Consulta el estado antes de reintentar.",
      503,
    );
  }
}
export async function fetchTransaction(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id))
    throw new CommerceError(
      "INVALID_TRANSACTION",
      "Transacción inválida.",
      400,
    );
  const result = z
    .object({ data: transactionSchema })
    .parse(await wompiRequest("transactions/" + encodeURIComponent(id)));
  if (result.data.id !== id)
    throw new CommerceError(
      "PAYMENT_MISMATCH",
      "La transacción no coincide.",
      409,
    );
  return result.data;
}
export function verifyEvent(input: unknown) {
  const event = z
    .object({
      event: z.literal("transaction.updated"),
      environment: z.literal("test"),
      timestamp: z.number().int().positive(),
      data: z.record(z.string(), z.unknown()),
      signature: z.object({
        properties: z.array(z.string().max(120)).min(1).max(30),
        checksum: z.string().regex(/^[a-fA-F0-9]{64}$/),
      }),
    })
    .parse(input);
  const values = event.signature.properties.map((path) => {
    let value: unknown = event.data;
    for (const key of path.split(".")) {
      if (
        ["__proto__", "prototype", "constructor"].includes(key) ||
        typeof value !== "object" ||
        value === null ||
        !Object.hasOwn(value, key)
      )
        throw new CommerceError(
          "INVALID_SIGNATURE",
          "Firma de evento inválida.",
          401,
        );
      value = (value as Record<string, unknown>)[key];
    }
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    )
      throw new CommerceError(
        "INVALID_SIGNATURE",
        "Firma de evento inválida.",
        401,
      );
    return String(value);
  });
  // A signed ID is mandatory; authoritative status, reference and amount are fetched server-side.
  if (!event.signature.properties.includes("transaction.id"))
    throw new CommerceError(
      "INVALID_SIGNATURE",
      "Falta el identificador firmado.",
      401,
    );
  const expected = createHash("sha256")
    .update(values.join("") + event.timestamp + paymentConfig().events)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(event.signature.checksum, "hex")))
    throw new CommerceError(
      "INVALID_SIGNATURE",
      "Firma de evento inválida.",
      401,
    );
  return transactionSchema.parse(event.data.transaction).id;
}
