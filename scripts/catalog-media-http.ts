import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getDb } from "../src/lib/db";
import { issueToken, consumeToken } from "../src/modules/auth/service";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
const dbUrl = new URL(process.env.DATABASE_URL ?? "");
if (
  dbUrl.hostname !== "127.0.0.1" ||
  dbUrl.port !== "55432" ||
  dbUrl.pathname !== "/aurum_dev" ||
  process.env.APP_ENV !== "development"
)
  throw Error("Solo desarrollo local");
const origin = "http://127.0.0.1:3000",
  tag = randomUUID(),
  email = "admin-http-" + tag + "@example.invalid",
  password = "Prueba exclusiva " + randomUUID();
const jar = new Map<string, string>();
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  badOrigin = false,
) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      Connection: "close",
      Origin: badOrigin ? "https://untrusted.invalid" : origin,
      "Content-Type": "application/json",
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join(";"),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0],
      i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  return { status: response.status, data: await response.json() };
}
async function upload(
  bytes: Uint8Array,
  label = "Foto HTTP ejemplo",
  badOrigin = false,
) {
  const body = new FormData();
  body.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    "foto.jpg",
  );
  body.set("label", label);
  const r = await fetch(origin + "/api/admin/media", {
    method: "POST",
    headers: {
      Connection: "close",
      Origin: badOrigin ? "https://untrusted.invalid" : origin,
      Cookie: [...jar].map(([k, v]) => k + "=" + v).join("; "),
    },
    body,
  });
  return { status: r.status, data: await r.json() };
}
let pid = "",
  cid = "";
try {
  assert.equal((await call("/api/admin/media")).status, 401);
  assert.equal((await call("/api/admin/collections")).status, 401);
  assert.equal(
    (
      await call("/api/auth/register", "POST", {
        name: "Catálogo HTTP",
        email,
        password,
        acceptedDemo: true,
      })
    ).status,
    202,
  );
  await call("/api/auth/login", "POST", { email, password });
  assert.equal((await upload(Buffer.from("fake"))).status, 403);
  assert.equal((await call("/api/admin/collections", "POST", {})).status, 403);
  const link = await issueToken(email, "VERIFY");
  assert.ok(link);
  await consumeToken({ token: link.token }, "VERIFY");
  await changeDevelopmentRole(email, "grant");
  await call("/api/auth/login", "POST", { email, password });
  const { readFile } = await import("node:fs/promises"),
    original = await readFile("public/images/product-1.jpg");
  assert.equal((await upload(original, "Foto origen", true)).status, 403);
  assert.equal((await call("/api/admin/media", "POST", {})).status, 415);
  assert.equal((await upload(Buffer.from("fake"))).status, 400);
  const mediaBefore = await getDb().mediaAsset.count();
  try {
    assert.equal((await upload(Buffer.alloc(6 * 1024 * 1024))).status, 413);
  } catch (e) {
    // Next/Node may close the socket when the bounded reader cancels an oversized body.
    assert.equal(
      (e as { cause?: { code?: string } }).cause?.code,
      "ECONNRESET",
    );
  }
  assert.equal(await getDb().mediaAsset.count(), mediaBefore);
  const loaded = await upload(original);
  assert.equal(loaded.status, 201);
  const image = loaded.data.url;
  const binary = await fetch(origin + image);
  assert.equal(binary.status, 200);
  assert.equal(binary.headers.get("content-type"), "image/webp");
  assert.equal(binary.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await fetch(origin + "/media/" + randomUUID())).status, 404);
  const fields = {
    name: "Colección HTTP " + tag,
    slug: "coleccion-http-" + tag,
    description: "Colección de ejemplo",
    active: true,
    reason: "Validación HTTP de colecciones",
  };
  const collection = await call("/api/admin/collections", "POST", fields);
  assert.equal(collection.status, 201);
  cid = collection.data.id;
  assert.equal(
    (
      await call(
        "/api/admin/collections/" + cid,
        "PATCH",
        { ...fields, expectedVersion: 0 },
        true,
      )
    ).status,
    403,
  );
  const p = await call("/api/admin/products", "POST", {
    product: {
      name: "Pieza foto HTTP",
      slug: "pieza-foto-http-" + tag,
      description: "Ficha de ejemplo con fotografía cargada",
      category: "Cadenas",
      image,
      gallery: [image],
      collectionIds: [cid],
      active: true,
    },
    variant: {
      sku: "IMG_" + tag.toUpperCase(),
      label: "45 cm",
      price: 95000,
      active: true,
    },
    reason: "Crear pieza HTTP de ejemplo",
  });
  assert.equal(p.status, 201);
  pid = p.data.id;
  const publicCatalog = await call("/api/catalog");
  const found = publicCatalog.data.products.find(
    (x: { id: string }) => x.id === pid,
  );
  assert.equal(found.image, image);
  assert.equal(found.collections[0].id, cid);
  assert.equal(
    (
      await call("/api/admin/collections/" + cid, "PATCH", {
        ...fields,
        active: false,
        expectedVersion: 0,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("/api/admin/collections/" + cid, "PATCH", {
        ...fields,
        expectedVersion: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call("/api/catalog")).data.products.find(
      (x: { id: string }) => x.id === pid,
    ).collections.length,
    0,
  );
  await changeDevelopmentRole(email, "revoke");
  assert.equal((await call("/api/admin/media")).status, 401);
  console.log(
    "PASS HTTP fotografías y colecciones: permisos, origen, límite, formato, carga, entrega pública, asociación y conflictos.",
  );
} finally {
  if (pid)
    await getDb().product.update({
      where: { id: pid },
      data: { active: false },
    });
  if (cid)
    await getDb().collection.update({
      where: { id: cid },
      data: { active: false },
    });
  await changeDevelopmentRole(email, "revoke").catch(() => {});
  await getDb().$disconnect();
}
