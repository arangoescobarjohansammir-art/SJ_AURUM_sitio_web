import { z } from "zod";
import { CommerceError } from "../commerce/service";
import type { EnviaRate } from "./envia-validation";
export function envioclickConfig() {
  if (
    process.env.APP_ENV !== "development" ||
    process.env.ENVIOCLICK_ENVIRONMENT !== "sandbox"
  )
    throw new CommerceError(
      "ENVIOCLICK_CLOSED",
      "Envíoclick solo permite guías de prueba.",
      503,
    );
  const token = process.env.ENVIOCLICK_API_KEY?.trim();
  if (!token || token.length < 20 || /\s/.test(token))
    throw new CommerceError(
      "ENVIOCLICK_CONFIG",
      "Falta configurar la clave de Envíoclick.",
      503,
    );
  return { token };
}
export async function envioclickRequest(
  path: "/quotation" | "/shipment_sandbox",
  body: unknown,
) {
  if (!["/quotation", "/shipment_sandbox"].includes(path))
    throw Error("Endpoint bloqueado");
  const { token } = envioclickConfig();
  try {
    const r = await fetch("https://api.envioclickpro.com.co/api/v2" + path, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error("HTTP " + r.status);
    return (await r.json()) as unknown;
  } catch {
    throw new CommerceError(
      "ENVIOCLICK_REQUEST",
      "Envíoclick no confirmó la solicitud. Revisa la configuración y los datos del envío.",
      502,
    );
  }
}
const short = (max: number) => z.string().trim().min(2).max(max);
const contactSchema = z.object({
  company: short(28),
  firstName: short(14),
  lastName: short(14),
  email: z.email().min(8).max(60),
  phone: z.string().regex(/^\d{10}$/),
  address: z.string().trim().min(8).max(50),
  suburb: short(30),
  crossStreet: short(35),
  reference: short(25),
  daneCode: z.string().regex(/^\d{8}$/),
});
const packageSchema = z.object({
  weight: z.number().min(1).max(30),
  length: z.number().min(1).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
});
export const clickPayloadSchema = z.object({
  origin: contactSchema,
  destination: contactSchema,
  packages: z.array(packageSchema).length(1),
  description: z.string().min(3).max(25),
  contentValue: z.number().int().min(0).max(3000000),
});
export function clickRates(body: unknown): EnviaRate[] {
  const response = z
    .object({
      status: z.literal("OK"),
      data: z.object({ rates: z.array(z.unknown()).max(100) }),
    })
    .parse(body);
  const schema = z.object({
    idRate: z.number().int().positive(),
    carrier: short(100),
    product: short(100),
    flete: z.number().finite().nonnegative(),
    minimumInsurance: z.number().finite().nonnegative(),
    deliveryDays: z.number().nonnegative(),
    cod: z.literal(false),
  });
  const rates = response.data.rates.flatMap((value) => {
    const r = schema.safeParse(value);
    if (!r.success) return [];
    const v = r.data,
      totalPrice = v.flete + v.minimumInsurance;
    if (totalPrice > 10000000) return [];
    return [
      {
        idRate: v.idRate,
        carrier: v.carrier,
        service: v.product,
        totalPrice,
        currency: "COP" as const,
        deliveryEstimate: v.deliveryDays + " días",
      },
    ];
  });
  if (!rates.length)
    throw new CommerceError(
      "NO_RATES",
      "Envíoclick no devolvió tarifas sin contraentrega para estos datos.",
    );
  return rates;
}
export function safeClickLabelUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.hostname === "s3-us-west-2.amazonaws.com" &&
      u.pathname === "/envioclickpro-util/sandbox_guide.pdf" &&
      !u.search &&
      !u.hash
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function clickLabel(body: unknown, rate: EnviaRate) {
  const r = z
    .object({
      status: z.literal("OK"),
      data: z.object({
        idRate: z.number().int().positive(),
        tracker: z.string().regex(/^[A-Za-z0-9_-]{3,80}$/),
        url: z.string().max(2000),
      }),
    })
    .parse(body).data;
  if (r.idRate !== rate.idRate) throw Error("Tarifa de respuesta incorrecta");
  const label = safeClickLabelUrl(r.url);
  if (!label) throw Error("URL de guía no reconocida");
  return {
    carrier: rate.carrier,
    service: rate.service,
    trackingNumber: r.tracker,
    label,
  };
}
