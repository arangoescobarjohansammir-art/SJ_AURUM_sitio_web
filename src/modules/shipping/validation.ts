import { z } from "zod";
export const normalizeDestination = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const shippingStates = {
  PENDING: "Por preparar",
  PREPARING: "En preparación",
  SHIPPED: "En tránsito",
  DELIVERED: "Entregado",
  ISSUE: "Con novedad",
  RETURNED: "Devuelto",
} as const;
export const rateSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    expectedVersion: z.number().int().nonnegative().optional(),
    department: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    amount: z.number().int().min(0).max(1000000),
    carrier: z.string().trim().min(3).max(100),
    minDays: z.number().int().min(1).max(60),
    maxDays: z.number().int().min(1).max(60),
    active: z.boolean(),
    reason: z.string().trim().min(8).max(500),
  })
  .refine(
    (v) => v.maxDays >= v.minDays,
    "El plazo máximo debe ser mayor o igual al mínimo",
  )
  .refine((v) => !v.id || v.expectedVersion !== undefined, "Falta versión");
export const shipmentSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    status: z.enum(["PREPARING", "SHIPPED", "DELIVERED", "ISSUE", "RETURNED"]),
    carrier: z.string().trim().min(3).max(100),
    trackingNumber: z
      .string()
      .trim()
      .max(80)
      .regex(/^[a-zA-Z0-9 _-]*$/),
    note: z.string().trim().min(8).max(500),
  })
  .refine(
    (v) =>
      !["SHIPPED", "DELIVERED", "RETURNED"].includes(v.status) ||
      v.trackingNumber.length >= 3,
    "Falta número de guía",
  );
export type Rate = {
  id: string;
  version: number;
  department: string;
  city: string;
  amount: number;
  carrier: string;
  minDays: number;
  maxDays: number;
  active: boolean;
};
export type ShippingView = {
  enviaShipment: {
    provider: string;
    providerStatus: string;
    checkedAt: string | null;
  } | null;
  shippingCarrier: string;
  shippingEstimate: string;
  shippingStatus: keyof typeof shippingStates;
  trackingNumber: string;
  shippingEvents: {
    id: string;
    status: keyof typeof shippingStates;
    note: string;
    createdAt: string;
  }[];
};
