import { z } from "zod";
import { findVariant } from "../catalog/products";
export const cartSchema = z
  .array(
    z.object({
      variantId: z.string().max(100),
      quantity: z.number().int().min(1).max(99),
    }),
  )
  .max(50);
export type CartLine = z.infer<typeof cartSchema>[number];
export function sanitizeCart(input: unknown): CartLine[] {
  const parsed = cartSchema.safeParse(input);
  if (!parsed.success) return [];
  const quantities = new Map<string, number>();
  for (const line of parsed.data) {
    const found = findVariant(line.variantId);
    if (!found || found.variant.stock === 0) continue;
    quantities.set(
      line.variantId,
      Math.min(
        found.variant.stock,
        (quantities.get(line.variantId) ?? 0) + line.quantity,
      ),
    );
  }
  return [...quantities].map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));
}
export function cartSubtotal(lines: CartLine[]) {
  return sanitizeCart(lines).reduce(
    (total, line) =>
      total + findVariant(line.variantId)!.variant.price * line.quantity,
    0,
  );
}
