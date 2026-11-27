import { z } from "zod";
export const collectionSchema = z.object({
  name: z.string().trim().min(3).max(80),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(600),
  active: z.boolean(),
  reason: z.string().trim().min(8).max(300),
});
export const collectionEditSchema = collectionSchema.extend({
  expectedVersion: z.number().int().nonnegative(),
});
export type CollectionRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  version: number;
  _count: { products: number };
};
export type AssetRecord = {
  id: string;
  label: string;
  width: number;
  height: number;
  size: number;
  url: string;
};
