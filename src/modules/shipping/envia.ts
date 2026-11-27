import { z } from "zod";
import { CommerceError } from "../commerce/service";
import { enviaRateSchema } from "./envia-validation";
export const ENVIA_SANDBOX_URL = "https://api-test.envia.com";
export function enviaConfig() {
  if (
    process.env.APP_ENV !== "development" ||
    process.env.ENVIA_ENVIRONMENT !== "sandbox"
  )
    throw new CommerceError(
      "ENVIA_CLOSED",
      "Envia solo está habilitado en Sandbox.",
      503,
    );
  const token = process.env.ENVIA_API_TOKEN?.trim();
  if (!token || token.length < 20 || /\s/.test(token))
    throw new CommerceError(
      "ENVIA_NOT_CONFIGURED",
      "Falta configurar el token Sandbox de Envia en .env.",
      503,
    );
  return { token };
}
export async function enviaRequest(
  path: "/ship/rate/" | "/ship/generate/" | "/ship/generaltrack/",
  body: unknown,
) {
  const { token } = enviaConfig();
  let response: Response;
  try {
    response = await fetch(ENVIA_SANDBOX_URL + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new CommerceError(
      "ENVIA_UNAVAILABLE",
      "Envia no respondió. Comprueba el resultado en su panel antes de repetir una guía.",
      502,
    );
  }
  if (!response.ok)
    throw new CommerceError(
      "ENVIA_REJECTED",
      response.status === 401 || response.status === 403
        ? "Envia rechazó el token. Comprueba que sea de Sandbox."
        : "Envia rechazó la solicitud. Revisa dirección, servicio y paquete en su panel Sandbox.",
      502,
    );
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new CommerceError(
      "ENVIA_RESPONSE",
      "La respuesta de Envia no es válida.",
      502,
    );
  }
}
export function parseRates(body: unknown) {
  const parsed = z
    .object({ meta: z.literal("rate"), data: z.array(z.unknown()).max(100) })
    .parse(body);
  const rates = parsed.data.flatMap((r) => {
    const v = enviaRateSchema.safeParse(r);
    return v.success ? [v.data] : [];
  });
  if (!rates.length)
    throw new CommerceError(
      "ENVIA_NO_RATES",
      "Envia no devolvió servicios en COP para esos datos.",
    );
  return rates;
}
export function safeLabelUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (u.hostname === "envia.com" || u.hostname.endsWith(".envia.com"))
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function parseLabel(body: unknown) {
  return z
    .object({
      meta: z.literal("generate"),
      data: z
        .array(
          z.object({
            carrier: z.string().min(1).max(100),
            service: z.string().min(1).max(100),
            trackingNumber: z.string().regex(/^[A-Za-z0-9_-]{3,100}$/),
            label: z.string().max(2000),
            currency: z.literal("COP"),
          }),
        )
        .length(1),
    })
    .parse(body).data[0];
}
