import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { adminTransaction } from "./service";
import { requireAdmin } from "../auth/service";
import { CommerceError } from "../commerce/service";
import { collectionSchema, collectionEditSchema } from "./catalog-validation";
const assetSelect = {
  id: true,
  label: true,
  width: true,
  height: true,
  size: true,
} as const;
export const maxImageBytes = 5 * 1024 * 1024;
export async function uploadImage(
  token: string | undefined,
  bytes: Buffer,
  label: string,
) {
  await requireAdmin(token);
  if (!bytes.length || bytes.length > maxImageBytes)
    throw new CommerceError(
      "IMAGE_SIZE",
      "La fotografía debe pesar entre 1 byte y 5 MB.",
      413,
    );
  if (label.trim().length < 3 || label.trim().length > 100)
    throw new CommerceError(
      "IMAGE_LABEL",
      "Describe la fotografía en 3 a 100 caracteres.",
      400,
    );
  let result;
  try {
    const source = sharp(bytes, {
      limitInputPixels: 20000000,
      failOn: "warning",
    });
    const meta = await source.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) > 1
    )
      throw Error("format");
    result = await source
      .rotate()
      .resize({
        width: 1800,
        height: 1800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new CommerceError(
      "INVALID_IMAGE",
      "Usa una fotografía JPG, PNG o WebP estática válida, de hasta 20 megapíxeles.",
      400,
    );
  }
  if (result.data.length > maxImageBytes)
    throw new CommerceError(
      "IMAGE_SIZE",
      "La imagen optimizada supera 5 MB.",
      413,
    );
  return adminTransaction(token, async (tx, actorId) => {
    if ((await tx.mediaAsset.count()) >= 500)
      throw new CommerceError(
        "MEDIA_LIMIT",
        "La biblioteca local admite hasta 500 fotografías.",
        409,
      );
    const id = randomUUID();
    const asset = await tx.mediaAsset.create({
      data: {
        id,
        label: label.trim(),
        width: result.info.width,
        height: result.info.height,
        size: result.data.length,
        data: new Uint8Array(result.data),
      },
      select: assetSelect,
    });
    await tx.adminAudit.create({
      data: {
        actorId,
        action: "MEDIA_UPLOAD",
        entityId: id,
        before: {},
        after: asset,
        reason: "Carga de fotografía: " + label.trim(),
      },
    });
    return { ...asset, url: "/media/" + id };
  });
}
export async function listMedia(token: string | undefined) {
  return adminTransaction(token, async (tx) =>
    (
      await tx.mediaAsset.findMany({
        select: assetSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 500,
      })
    ).map((a) => ({ ...a, url: "/media/" + a.id })),
  );
}
export async function listCollections(token: string | undefined) {
  return adminTransaction(token, (tx) =>
    tx.collection.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  );
}
export async function saveCollection(
  token: string | undefined,
  input: unknown,
  id?: string,
) {
  try {
    return await adminTransaction(token, async (tx, actorId) => {
      const data = id
        ? collectionEditSchema.parse(input)
        : collectionSchema.parse(input);
      const before = id
        ? await tx.collection.findUnique({ where: { id } })
        : null;
      if (id && !before)
        throw new CommerceError("NOT_FOUND", "Colección no encontrada.", 404);
      if (
        before &&
        before.version !==
          ("expectedVersion" in data ? data.expectedVersion : undefined)
      )
        throw new CommerceError(
          "EDIT_CONFLICT",
          "La colección cambió; recarga antes de guardar.",
          409,
        );
      if (!id && (await tx.collection.count()) >= 100)
        throw new CommerceError(
          "COLLECTION_LIMIT",
          "Máximo 100 colecciones en esta versión.",
          409,
        );
      const fields = {
        name: data.name,
        slug: data.slug,
        description: data.description,
        active: data.active,
      };
      const after = id
        ? await tx.collection.update({
            where: { id },
            data: { ...fields, version: { increment: 1 } },
          })
        : await tx.collection.create({ data: fields });
      const snapshot = (c: typeof after) => ({
        name: c.name,
        slug: c.slug,
        description: c.description,
        active: c.active,
        version: c.version,
      });
      await tx.adminAudit.create({
        data: {
          actorId,
          action: id ? "COLLECTION_EDIT" : "COLLECTION_CREATE",
          entityId: after.id,
          before: before ? snapshot(before) : {},
          after: snapshot(after),
          reason: data.reason,
        },
      });
      return after;
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new CommerceError(
        "DUPLICATE",
        "El enlace de la colección ya existe.",
        409,
      );
    throw e;
  }
}
