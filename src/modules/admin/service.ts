import { randomUUID } from "node:crypto";
import { getDb } from "../../lib/db";
import { CommerceError, transaction } from "../commerce/service";
import { requireDevelopmentAccounts } from "../auth/service";
import { tokenHash } from "../auth/password";
import type { Prisma } from "../../generated/prisma/client";
import {
  createProductSchema,
  editProductSchema,
  createVariantSchema,
  editVariantSchema,
  stockSchema,
  listingSchema,
} from "./validation";
type Tx = Prisma.TransactionClient;
export async function adminTransaction<T>(
  token: string | undefined,
  run: (tx: Tx, actorId: string) => Promise<T>,
) {
  requireDevelopmentAccounts();
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new CommerceError(
      "AUTH_REQUIRED",
      "Inicia sesión para administrar.",
      401,
    );
  return transaction(async (tx) => {
    const session = await tx.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
    });
    if (!session || session.expiresAt <= new Date())
      throw new CommerceError("AUTH_REQUIRED", "La sesión venció.", 401);
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Customer" WHERE "id"=${session.customerId} AND "active"=true AND "role"='ADMIN' AND "verifiedAt" IS NOT NULL FOR UPDATE`;
    if (!rows.length)
      throw new CommerceError(
        "FORBIDDEN",
        "Necesitas una cuenta administradora verificada.",
        403,
      );
    return run(tx, session.customerId);
  });
}
const audit = (
  tx: Tx,
  actorId: string,
  action: string,
  entityId: string,
  before: Prisma.InputJsonValue,
  after: Prisma.InputJsonValue,
  reason: string,
) =>
  tx.adminAudit.create({
    data: { actorId, action, entityId, before, after, reason },
  });
const productSnapshot = (p: {
  collections?: { id: string }[];
  name: string;
  slug: string;
  category: string;
  description: string;
  image: string;
  gallery: string[];
  active: boolean;
  version: number;
}) => ({
  collections: p.collections?.map((c) => c.id).sort() ?? [],
  name: p.name,
  slug: p.slug,
  category: p.category,
  description: p.description,
  image: p.image,
  gallery: p.gallery,
  active: p.active,
  version: p.version,
});
const variantSnapshot = (v: {
  sku: string;
  label: string;
  price: number;
  stock: number;
  reserved: number;
  active: boolean;
  version: number;
}) => ({
  sku: v.sku,
  label: v.label,
  price: v.price,
  stock: v.stock,
  reserved: v.reserved,
  active: v.active,
  version: v.version,
});
const conflict = () =>
  new CommerceError(
    "EDIT_CONFLICT",
    "Otra operación modificó esta ficha. Recarga los datos antes de editar de nuevo.",
    409,
  );
async function product(tx: Tx, id: string) {
  const p = await tx.product.findUnique({
    where: { id },
    include: { collections: true },
  });
  if (!p || !p.demo)
    throw new CommerceError(
      "NOT_FOUND",
      "Producto de prueba no encontrado.",
      404,
    );
  return p;
}
async function variant(tx: Tx, id: string) {
  const v = await tx.variant.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!v || !v.product.demo)
    throw new CommerceError(
      "NOT_FOUND",
      "Variante de prueba no encontrada.",
      404,
    );
  return v;
}
async function uniqueness<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new CommerceError(
        "DUPLICATE",
        "El enlace del producto o SKU ya existe. Usa uno diferente.",
        409,
      );
    throw e;
  }
}
export async function listProducts(token: string | undefined, input: unknown) {
  return adminTransaction(token, async (tx) => {
    const { query, page } = listingSchema.parse(input),
      where = {
        demo: true,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { slug: { contains: query, mode: "insensitive" as const } },
                {
                  variants: {
                    some: {
                      sku: { contains: query, mode: "insensitive" as const },
                    },
                  },
                },
              ],
            }
          : {}),
      };
    const total = await tx.product.count({ where });
    const products = await tx.product.findMany({
      where,
      include: { collections: true, variants: { orderBy: { id: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 20,
      take: 20,
    });
    return { products, total, page, pages: Math.max(1, Math.ceil(total / 20)) };
  });
}
export async function productDetail(token: string | undefined, id: string) {
  return adminTransaction(token, async (tx) => {
    await product(tx, id);
    const result = await tx.product.findUniqueOrThrow({
      where: { id },
      include: { collections: true, variants: { orderBy: { id: "asc" } } },
    });
    const entities = [id, ...result.variants.map((v) => v.id)];
    const audits = await tx.adminAudit.findMany({
      where: { entityId: { in: entities } },
      select: {
        id: true,
        action: true,
        entityId: true,
        before: true,
        after: true,
        reason: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });
    return { product: result, audits };
  });
}
export async function createProduct(token: string | undefined, input: unknown) {
  return uniqueness(() =>
    adminTransaction(token, async (tx, actorId) => {
      const data = createProductSchema.parse(input),
        id = randomUUID(),
        variantId = randomUUID();
      await validateReferences(tx, data.product);
      const { collectionIds, ...fields } = data.product;
      if (data.product.active && !data.variant.active)
        throw new CommerceError(
          "NO_VARIANTS",
          "Un producto activo necesita una variante activa.",
          400,
        );
      if (!data.product.gallery.includes(data.product.image))
        throw new CommerceError(
          "VALIDATION",
          "Incluye la imagen principal en la galería.",
          400,
        );
      const created = await tx.product.create({
        data: {
          ...fields,
          collections: {
            connect: [...new Set(collectionIds)].map((id) => ({ id })),
          },
          gallery: [...new Set(data.product.gallery)],
          id,
          demo: true,
          variants: { create: { ...data.variant, id: variantId, stock: 0 } },
        },
        include: { variants: true, collections: true },
      });
      await audit(
        tx,
        actorId,
        "PRODUCT_CREATE",
        id,
        {},
        productSnapshot(created),
        data.reason,
      );
      await audit(
        tx,
        actorId,
        "VARIANT_CREATE",
        variantId,
        {},
        variantSnapshot(created.variants[0]),
        data.reason,
      );
      return { id };
    }),
  );
}
export async function editProduct(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  return uniqueness(() =>
    adminTransaction(token, async (tx, actorId) => {
      const { expectedVersion, reason, ...data } =
          editProductSchema.parse(input),
        before = await product(tx, id);
      if (before.version !== expectedVersion) throw conflict();
      await validateReferences(tx, data);
      const { collectionIds, ...fields } = data;
      if (!data.gallery.includes(data.image))
        throw new CommerceError(
          "VALIDATION",
          "Incluye la imagen principal en la galería.",
          400,
        );
      if (
        data.active &&
        !(await tx.variant.count({ where: { productId: id, active: true } }))
      )
        throw new CommerceError(
          "NO_VARIANTS",
          "Activa una variante antes de publicar el producto.",
          409,
        );
      const updated = await tx.product.update({
        where: { id, version: expectedVersion },
        data: {
          ...fields,
          collections: {
            set: [...new Set(collectionIds)].map((id) => ({ id })),
          },
          gallery: [...new Set(data.gallery)],
          version: { increment: 1 },
        },
      });

      const after = await tx.product.findUniqueOrThrow({
        where: { id },
        include: { collections: true },
      });
      await audit(
        tx,
        actorId,
        "PRODUCT_EDIT",
        id,
        productSnapshot(before),
        productSnapshot(after),
        reason,
      );
      return { ok: true };
    }),
  );
}
export async function createVariant(
  token: string | undefined,
  productId: string,
  input: unknown,
) {
  return uniqueness(() =>
    adminTransaction(token, async (tx, actorId) => {
      const { reason, ...data } = createVariantSchema.parse(input);
      await product(tx, productId);
      if ((await tx.variant.count({ where: { productId } })) >= 30)
        throw new CommerceError(
          "VARIANT_LIMIT",
          "Máximo 30 variantes por producto.",
          400,
        );
      const created = await tx.variant.create({
        data: { ...data, id: randomUUID(), productId, stock: 0 },
      });
      await audit(
        tx,
        actorId,
        "VARIANT_CREATE",
        created.id,
        {},
        variantSnapshot(created),
        reason,
      );
      return { id: created.id };
    }),
  );
}
export async function editVariant(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  return uniqueness(() =>
    adminTransaction(token, async (tx, actorId) => {
      const { expectedVersion, reason, ...data } =
          editVariantSchema.parse(input),
        before = await variant(tx, id);
      if (before.version !== expectedVersion) throw conflict();
      if (
        !data.active &&
        before.product.active &&
        (await tx.variant.count({
          where: { productId: before.productId, active: true, id: { not: id } },
        })) === 0
      )
        throw new CommerceError(
          "LAST_VARIANT",
          "Desactiva primero el producto o conserva una variante activa.",
          409,
        );
      const changed = await tx.variant.updateMany({
        where: { id, version: expectedVersion },
        data: { ...data, version: { increment: 1 } },
      });
      if (!changed.count) throw conflict();
      const after = await tx.variant.findUniqueOrThrow({ where: { id } });
      await audit(
        tx,
        actorId,
        "VARIANT_EDIT",
        id,
        variantSnapshot(before),
        variantSnapshot(after),
        reason,
      );
      return { ok: true };
    }),
  );
}
export async function adjustStock(
  token: string | undefined,
  id: string,
  input: unknown,
) {
  return adminTransaction(token, async (tx, actorId) => {
    const { stock, expectedVersion, reason } = stockSchema.parse(input),
      before = await variant(tx, id);
    if (before.version !== expectedVersion) throw conflict();
    if (stock < before.reserved)
      throw new CommerceError(
        "RESERVED_STOCK",
        "El stock total no puede ser menor que las unidades reservadas.",
        409,
      );
    if (stock === before.stock)
      throw new CommerceError(
        "UNCHANGED_STOCK",
        "La cantidad coincide con el stock actual.",
        400,
      );
    const changed = await tx.variant.updateMany({
      where: { id, version: expectedVersion, reserved: { lte: stock } },
      data: { stock, version: { increment: 1 } },
    });
    if (!changed.count) throw conflict();
    const after = await tx.variant.findUniqueOrThrow({ where: { id } });
    await tx.inventoryMovement.create({
      data: {
        variantId: id,
        kind: "ADJUST",
        quantity: stock - before.stock,
        reason,
      },
    });
    await audit(
      tx,
      actorId,
      "STOCK_ADJUST",
      id,
      variantSnapshot(before),
      variantSnapshot(after),
      reason,
    );
    return { ok: true };
  });
}

async function validateReferences(
  tx: Tx,
  data: { image: string; gallery: string[]; collectionIds: string[] },
) {
  const ids = [
    ...new Set(
      [data.image, ...data.gallery]
        .filter((p) => p.startsWith("/media/"))
        .map((p) => p.slice(7)),
    ),
  ];
  if (
    (await tx.mediaAsset.count({ where: { id: { in: ids } } })) !== ids.length
  )
    throw new CommerceError(
      "INVALID_MEDIA",
      "Una fotografía no existe en la biblioteca.",
      400,
    );
  const collections = [...new Set(data.collectionIds)];
  if (
    (await tx.collection.count({ where: { id: { in: collections } } })) !==
    collections.length
  )
    throw new CommerceError(
      "INVALID_COLLECTION",
      "Una colección seleccionada ya no existe.",
      400,
    );
}
