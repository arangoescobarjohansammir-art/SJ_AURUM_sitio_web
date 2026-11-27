import { z } from "zod";
export const followUps = {
  PENDING: "Pendiente de revisión",
  REVIEWED: "Revisado",
  ISSUE: "Con incidencia",
  RESOLVED: "Resuelto",
} as const;
export const orderStates = {
  RESERVED: "Reservado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
} as const;
export const orderFilters = z.object({
  query: z.string().trim().max(100).default(""),
  status: z.enum(["", "RESERVED", "CANCELLED", "EXPIRED"]).default(""),
  followUp: z
    .enum(["", "PENDING", "REVIEWED", "ISSUE", "RESOLVED"])
    .default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const orderChange = z
  .object({
    action: z.enum(["FOLLOW_UP", "CANCEL"]),
    followUp: z.enum(["PENDING", "REVIEWED", "ISSUE", "RESOLVED"]).optional(),
    reason: z.string().trim().min(8).max(1000),
    expectedVersion: z.number().int().nonnegative(),
  })
  .refine(
    (v) => v.action !== "FOLLOW_UP" || !!v.followUp,
    "Selecciona el seguimiento",
  );
export type OrderSummary = {
  id: string;
  number: string;
  status: keyof typeof orderStates;
  followUp: keyof typeof followUps;
  version: number;
  total: number;
  createdAt: string;
  expiresAt: string;
  shippingLabel: string;
};
export type OrderDetail = OrderSummary & {
  subtotal: number;
  discount: number;
  shipping: number;
  couponCode: string | null;
  recipient: {
    name: string;
    email: string;
    phone: string;
    address: string;
    additional: string;
  };
  items: {
    productName: string;
    variantLabel: string;
    sku: string;
    unitPrice: number;
    quantity: number;
  }[];
  movements: {
    id: string;
    kind: string;
    quantity: number;
    reason: string;
    createdAt: string;
  }[];
};
export type OrderHistory = {
  id: string;
  action: string;
  reason: string;
  createdAt: string;
  actor: { name: string };
  before: {
    status: keyof typeof orderStates;
    followUp: keyof typeof followUps;
  };
  after: { status: keyof typeof orderStates; followUp: keyof typeof followUps };
};
export type OrderView = { order: OrderDetail; history: OrderHistory[] };
export type OrderListing = {
  orders: OrderSummary[];
  total: number;
  page: number;
  pages: number;
};
