import { z } from "zod";
const text = z.string().trim().min(1).max(100);
export const locationSchema = z.object({
  city: z.string().regex(/^\d{8}$/),
  state: z.string().regex(/^[A-Z0-9]{2,3}$/),
  postalCode: z.string().regex(/^\d{5,8}$/),
});
export const originSchema = locationSchema.extend({
  name: text,
  phone: z.string().regex(/^(?:\+57)?3\d{9}$/),
  street: z.string().trim().min(8).max(200),
});
export const enviaQuoteSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  origin: originSchema,
  destination: locationSchema,
  carrier: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{1,60}$/),
  weight: z.number().min(0.01).max(30),
  length: z.number().min(1).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
  acceptedSandbox: z.literal(true),
});
export const enviaRateSchema = z.object({
  carrier: text,
  service: text,
  totalPrice: z.number().finite().nonnegative().max(10000000),
  currency: z.literal("COP"),
  deliveryEstimate: z.string().max(100).optional().default("Consultar plazo"),
});
export type EnviaRate = z.infer<typeof enviaRateSchema>;
export type EnviaView = {
  state: string;
  quoteKey: string;
  rates: EnviaRate[];
  expiresAt: string;
  trackingNumber: string;
  labelUrl: string;
  carrier: string;
  service: string;
  providerStatus: string;
  checkedAt: string | null;
};
