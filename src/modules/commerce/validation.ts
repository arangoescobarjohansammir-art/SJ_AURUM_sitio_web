import { z } from "zod";
export const checkoutSchema = z.object({
  shippingRateId: z.string().min(1).max(100),
  coupon: z.string().trim().toUpperCase().max(40).default(""),
});
export const recipientSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+57)?3\d{9}$/, "Usa un celular colombiano de 10 dígitos"),
  address: z.string().trim().min(8).max(200),
  additional: z.string().trim().max(300).default(""),
});
export const orderSchema = checkoutSchema.extend({
  recipient: recipientSchema,
  quoteHash: z.string().regex(/^[a-f0-9]{64}$/),
  idempotencyKey: z.uuid(),
  acceptedDemo: z.literal(true),
});
export const cartChangeSchema = z.object({
  variantId: z.string().min(1).max(100),
  quantity: z.number().int().min(0).max(99),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
