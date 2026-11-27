import { CommerceError } from "../commerce/service";
import {
  enviaConfig,
  enviaRequest,
  parseRates,
  parseLabel,
  safeLabelUrl,
} from "./envia";
import {
  envioclickConfig,
  envioclickRequest,
  clickPayloadSchema,
  clickRates,
  clickLabel,
  safeClickLabelUrl,
} from "./envioclick";
import type { EnviaRate } from "./envia-validation";
export function activeProvider() {
  const value = process.env.SHIPPING_PROVIDER || "envia";
  if (value !== "envia" && value !== "envioclick")
    throw new CommerceError(
      "PROVIDER_CONFIG",
      "Proveedor de envíos no reconocido.",
      503,
    );
  return value;
}
export const providerName = (provider: string) =>
  provider === "envioclick" ? "Envíoclick" : "Envia.com";
export function providerConfig(provider: string) {
  if (provider === "envioclick") return envioclickConfig();
  if (provider === "envia") return enviaConfig();
  throw Error("Proveedor no reconocido");
}
export async function quoteProvider(provider: string, payload: unknown) {
  if (provider === "envia")
    return parseRates(await enviaRequest("/ship/rate/", payload));
  if (provider !== "envioclick") throw Error("Proveedor no reconocido");
  const p = clickPayloadSchema.parse(payload);
  return clickRates(
    await envioclickRequest("/quotation", {
      ...p,
      origin: { daneCode: p.origin.daneCode, address: p.origin.address },
      destination: {
        daneCode: p.destination.daneCode,
        address: p.destination.address,
      },
    }),
  );
}
export async function generateProvider(
  provider: string,
  payload: unknown,
  rate: EnviaRate,
  reference: string,
) {
  if (provider === "envia")
    return parseLabel(await enviaRequest("/ship/generate/", payload));
  if (provider !== "envioclick" || !rate.idRate)
    throw Error("Tarifa no válida");
  const p = clickPayloadSchema.parse(payload);
  return clickLabel(
    await envioclickRequest("/shipment_sandbox", {
      ...p,
      idRate: rate.idRate,
      myShipmentReference: reference.replaceAll("-", "").slice(0, 28),
      requestPickup: false,
      pickupDate: new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      insurance: false,
    }),
    rate,
  );
}
export function providerLabelUrl(provider: string, url: string) {
  return provider === "envioclick" ? safeClickLabelUrl(url) : safeLabelUrl(url);
}
