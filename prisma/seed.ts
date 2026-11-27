import "dotenv/config";
import { getDb } from "../src/lib/db";
import { products } from "../src/modules/catalog/products";

if (process.env.APP_ENV !== "development")
  throw new Error("El seed de ejemplo solo está permitido en desarrollo");
const db = getDb();
try {
  await db.$transaction(async (tx) => {
    for (const product of products) {
      const { variants, ...data } = product;
      await tx.product.upsert({
        where: { id: product.id },
        create: { ...data, active: true },
        update: {},
      });
      for (const variant of variants) {
        const existing = await tx.variant.findUnique({
          where: { id: variant.id },
        });
        if (existing) continue; // Never reset existing stock or prices on repeat seed.
        await tx.variant.create({
          data: {
            ...variant,
            productId: product.id,
            sku: variant.id.toUpperCase(),
          },
        });
        await tx.inventoryMovement.create({
          data: {
            variantId: variant.id,
            kind: "INITIAL",
            quantity: variant.stock,
            reason: "Carga inicial explícita de datos de ejemplo",
          },
        });
      }
    }
    await tx.coupon.upsert({
      where: { code: "EJEMPLO10" },
      update: {},
      create: {
        code: "EJEMPLO10",
        percent: 10,
        minimum: 50000,
        usageLimit: 100,
        active: true,
        demo: true,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      },
    });
    for (const rate of [
      {
        id: "demo-bogota",
        department: "Bogotá D.C.",
        city: "Bogotá",
        amount: 12000,
      },
      {
        id: "demo-medellin",
        department: "Antioquia",
        city: "Medellín",
        amount: 14000,
      },
      {
        id: "demo-cali",
        department: "Valle del Cauca",
        city: "Cali",
        amount: 15000,
      },
    ])
      await tx.shippingRate.upsert({
        where: { id: rate.id },
        update: {},
        create: { ...rate, active: true, demo: true },
      });
  });
  console.log(
    "Catálogo, cupón y tarifas de ejemplo creados. Los registros existentes se conservaron.",
  );
} finally {
  await db.$disconnect();
}
