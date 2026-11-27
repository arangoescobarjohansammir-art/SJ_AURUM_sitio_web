import { z } from "zod";
import { categories } from "../catalog/products";
export const images = [
  "/images/product-1.jpg",
  "/images/product-2.jpg",
  "/images/product-3.jpg",
  "/images/product-4.jpg",
  "/images/product-5.jpg",
  "/images/product-6.jpg",
  "/images/detail.jpg",
] as const;
const imagePath = z.union([
  z.enum(images),
  z
    .string()
    .regex(
      /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    ),
]);
const version = z.number().int().min(0);
const reason = z
  .string()
  .trim()
  .min(8, "Describe el motivo con al menos 8 caracteres.")
  .max(300);
export const productSchema = z.object({
  name: z.string().trim().min(3).max(100),
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.enum(categories),
  description: z.string().trim().min(12).max(2000),
  image: imagePath,
  gallery: z.array(imagePath).min(1).max(7),
  collectionIds: z.array(z.uuid()).max(10).default([]),
  active: z.boolean(),
});
export const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[A-Z0-9_-]+$/),
  label: z.string().trim().min(1).max(100),
  price: z.number().int().min(1).max(100000000),
  active: z.boolean(),
});
export const createProductSchema = z.object({
  product: productSchema,
  variant: variantSchema,
  reason,
});
export const editProductSchema = productSchema.extend({
  expectedVersion: version,
  reason,
});
export const createVariantSchema = variantSchema.extend({ reason });
export const editVariantSchema = variantSchema.extend({
  expectedVersion: version,
  reason,
});
export const stockSchema = z.object({
  stock: z.number().int().min(0).max(1000000),
  expectedVersion: version,
  reason,
});
export const listingSchema = z.object({
  query: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type AdminVariant = {
  id: string;
  sku: string;
  label: string;
  price: number;
  stock: number;
  reserved: number;
  active: boolean;
  version: number;
};
export type AdminProduct = {
  collections: { id: string; name: string; slug: string; active: boolean }[];
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  image: string;
  gallery: string[];
  demo: boolean;
  active: boolean;
  version: number;
  variants: AdminVariant[];
};
export type Audit = {
  id: string;
  action: string;
  entityId: string;
  reason: string;
  createdAt: string;
  actor: { name: string };
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};
