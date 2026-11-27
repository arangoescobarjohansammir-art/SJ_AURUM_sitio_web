import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { getDb } from "../src/lib/db";
import {
  register,
  login,
  issueToken,
  consumeToken,
} from "../src/modules/auth/service";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
import {
  uploadImage,
  listMedia,
  listCollections,
  saveCollection,
} from "../src/modules/admin/catalog-service";
import {
  createProduct,
  editProduct,
  productDetail,
} from "../src/modules/admin/service";
import { catalog } from "../src/modules/commerce/service";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo base local");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.toString();
process.env.APP_ENV = "development";
const m = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, stdio: "inherit", windowsHide: true },
);
if (m.status !== 0) throw Error("Migration failed");
const db = getDb(),
  tag = randomUUID(),
  email = "media-" + tag + "@example.invalid",
  password = "Prueba exclusiva " + randomUUID(),
  reason = "Validación de catálogo y fotografías";
let token = "",
  count = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log("PASS " + name);
  count++;
}
try {
  await register({
    name: "Operador catálogo",
    email,
    password,
    acceptedDemo: true,
  });
  const client = (await login({ email, password })).token;
  await check(
    "biblioteca, carga y colecciones requieren administrador verificado",
    async () => {
      await assert.rejects(() => listMedia(undefined), {
        code: "AUTH_REQUIRED",
      });
      await assert.rejects(
        () => uploadImage(client, Buffer.from("fake"), "Foto"),
        { code: "FORBIDDEN" },
      );
      await assert.rejects(() => listCollections(client), {
        code: "FORBIDDEN",
      });
      await assert.rejects(() => saveCollection(client, {}), {
        code: "FORBIDDEN",
      });
    },
  );
  const link = await issueToken(email, "VERIFY");
  assert.ok(link);
  await consumeToken({ token: link.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  token = (await login({ email, password })).token;
  const original = await readFile("public/images/product-1.jpg");
  await check(
    "rechazo de bytes falsos, SVG, tamaños excesivos y etiquetas inválidas",
    async () => {
      const before = await db.mediaAsset.count();
      for (const bytes of [
        Buffer.from("not an image"),
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',
        ),
      ])
        await assert.rejects(
          () => uploadImage(token, bytes, "Foto rechazada"),
          { code: "INVALID_IMAGE" },
        );
      await assert.rejects(
        () => uploadImage(token, Buffer.alloc(5 * 1024 * 1024 + 1), "Excesiva"),
        { code: "IMAGE_SIZE" },
      );
      await assert.rejects(() => uploadImage(token, original, "x"), {
        code: "IMAGE_LABEL",
      });
      assert.equal(await db.mediaAsset.count(), before);
    },
  );
  let asset: Awaited<ReturnType<typeof uploadImage>>;
  await check(
    "imagen normalizada a WebP sin EXIF y carga auditada",
    async () => {
      const tagged = await sharp(original)
        .withExif({ IFD0: { Artist: "TEST_PRIVATE_METADATA" } })
        .toBuffer();
      asset = await uploadImage(token, tagged, "Foto prueba " + tag);
      const stored = await db.mediaAsset.findUniqueOrThrow({
          where: { id: asset.id },
        }),
        meta = await sharp(stored.data).metadata();
      assert.equal(meta.format, "webp");
      assert.equal(meta.exif, undefined);
      assert.ok(meta.width <= 1800 && meta.height <= 1800);
      assert.equal(stored.size, stored.data.length);
      assert.equal(
        await db.adminAudit.count({
          where: { entityId: asset.id, action: "MEDIA_UPLOAD" },
        }),
        1,
      );
      assert.ok((await listMedia(token)).some((a) => a.id === asset.id));
    },
  );
  const fields = {
    name: "Colección " + tag,
    slug: "coleccion-" + tag,
    description: "Ejemplo editable",
    active: true,
    reason,
  };
  const c = await saveCollection(token, fields);
  await check(
    "colecciones únicas y edición concurrente sin sobrescrituras",
    async () => {
      await assert.rejects(() => saveCollection(token, fields), {
        code: "DUPLICATE",
      });
      const r = await Promise.allSettled(
        ["Primera", "Segunda"].map((name) =>
          saveCollection(token, { ...fields, name, expectedVersion: 0 }, c.id),
        ),
      );
      assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(await db.adminAudit.count({ where: { entityId: c.id } }), 2);
    },
  );
  const product = {
    name: "Producto fotografía " + tag,
    slug: "foto-" + tag,
    category: "Cadenas",
    description: "Producto ficticio con fotografía subida",
    image: asset!.url,
    gallery: [asset!.url, "/images/product-1.jpg"],
    active: true,
    collectionIds: [c.id],
  };
  const variant = {
    sku: "FOTO_" + tag.toUpperCase(),
    label: "45 cm",
    price: 95000,
    active: true,
  };
  let pid = "";
  await check(
    "referencias validadas y fotografía persistida en catálogo",
    async () => {
      await assert.rejects(
        () =>
          createProduct(token, {
            product: { ...product, image: "/media/" + randomUUID() },
            variant,
            reason,
          }),
        { code: "INVALID_MEDIA" },
      );
      await assert.rejects(
        () =>
          createProduct(token, {
            product: { ...product, collectionIds: [randomUUID()] },
            variant,
            reason,
          }),
        { code: "INVALID_COLLECTION" },
      );
      await assert.rejects(() =>
        createProduct(token, {
          product: { ...product, image: "https://external.invalid/image.jpg" },
          variant,
          reason,
        }),
      );
      pid = (await createProduct(token, { product, variant, reason })).id;
      const p = (await catalog()).find((p) => p.id === pid)!;
      assert.equal(p.image, asset!.url);
      assert.equal(p.collections[0].id, c.id);
      assert.deepEqual(p.gallery, product.gallery);
      await editProduct(token, pid, {
        ...product,
        gallery: ["/images/product-1.jpg", asset!.url],
        reason,
        expectedVersion: 0,
      });
      assert.deepEqual((await productDetail(token, pid)).product.gallery, [
        "/images/product-1.jpg",
        asset!.url,
      ]);
    },
  );
  await check(
    "ocultar colección preserva producto y relaciones; cambios auditados",
    async () => {
      await saveCollection(
        token,
        { ...fields, active: false, expectedVersion: 1 },
        c.id,
      );
      const p = (await catalog()).find((p) => p.id === pid)!;
      assert.ok(p);
      assert.equal(p.collections.length, 0);
      assert.equal(
        (await productDetail(token, pid)).product.collections.length,
        1,
      );
      await editProduct(token, pid, {
        ...product,
        collectionIds: [],
        reason,
        expectedVersion: 1,
      });
      const d = await productDetail(token, pid);
      assert.equal(d.product.collections.length, 0);
      assert.ok(
        d.audits.some(
          (a) =>
            (a.after as { collections?: string[] }).collections?.length === 0,
        ),
      );
    },
  );
  await check(
    "revocación cierra escritura y lectura de la biblioteca",
    async () => {
      await changeDevelopmentRole(email, "revoke");
      await assert.rejects(() => listMedia(token), { code: "AUTH_REQUIRED" });
      await assert.rejects(
        () => uploadImage(token, original, "Foto revocada"),
        { code: "AUTH_REQUIRED" },
      );
    },
  );
  console.log(count + " grupos de fotografías y colecciones aprobados.");
} finally {
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await db.$disconnect();
}
