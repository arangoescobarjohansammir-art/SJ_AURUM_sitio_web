import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/lib/db";
import {
  register,
  login,
  issueToken,
  consumeToken,
  authenticate,
} from "../src/modules/auth/service";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
import {
  createProduct,
  editProduct,
  createVariant,
  editVariant,
  adjustStock,
  listProducts,
  productDetail,
} from "../src/modules/admin/service";
import {
  catalog,
  setCartQuantity,
  quoteCart,
  createOrder,
  cancelOrder,
} from "../src/modules/commerce/service";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo PostgreSQL local");
url.pathname = "/aurum_test";
process.env.DATABASE_URL = url.toString();
process.env.APP_ENV = "development";
process.env.DEMO_CHECKOUT_ENABLED = "true";
const migrated = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env: process.env, stdio: "inherit", windowsHide: true },
);
if (migrated.status !== 0) throw Error("Migration failed");
const db = getDb(),
  tag = randomUUID(),
  email = "admin-" + tag + "@example.invalid",
  password = "Prueba exclusiva " + randomUUID(),
  reason = "Validación de administración local";
let token = "",
  customerToken = "",
  pid = "",
  vid = "",
  count = 0;
const product = {
  name: "Pieza de ejemplo " + tag,
  slug: "admin-" + tag,
  category: "Cadenas",
  description: "Ficha de ejemplo para pruebas de administración.",
  image: "/images/product-1.jpg",
  gallery: ["/images/product-1.jpg"],
  active: true,
};
const variant = {
  sku: "ADMIN_" + tag.toUpperCase(),
  label: "45 cm",
  price: 100000,
  active: true,
};
async function check(name: string, run: () => Promise<void>) {
  await run();
  console.log("PASS " + name);
  count++;
}
async function details() {
  return (await productDetail(token, pid)).product;
}
try {
  await check(
    "APIs de servicio rechazan visitante, cliente y administrador sin verificar",
    async () => {
      await assert.rejects(() => listProducts(undefined, {}), {
        code: "AUTH_REQUIRED",
      });
      const user = await register({
        name: "Administrador de prueba",
        email,
        password,
        acceptedDemo: true,
      });
      assert.ok(user);
      customerToken = (await login({ email, password })).token;
      await assert.rejects(() => createProduct(customerToken, {}), {
        code: "FORBIDDEN",
      });
      await assert.rejects(() => changeDevelopmentRole(email, "grant"), {
        code: "NOT_VERIFIED",
      });
      await db.customer.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
      await assert.rejects(() => listProducts(customerToken, {}), {
        code: "FORBIDDEN",
      });
      await db.customer.update({
        where: { id: user.id },
        data: { role: "CUSTOMER" },
      });
      const link = await issueToken(email, "VERIFY");
      assert.ok(link);
      await consumeToken({ token: link.token }, "VERIFY");
      await changeDevelopmentRole(email, "grant");
      assert.equal(await authenticate(customerToken), null);
      token = (await login({ email, password })).token;
    },
  );
  await check(
    "crear producto y variante audita autor, conserva demo y valida imágenes",
    async () => {
      await assert.rejects(() =>
        createProduct(token, {
          product: { ...product, image: "https://external.invalid/file.jpg" },
          variant,
          reason,
        }),
      );
      pid = (
        await createProduct(token, {
          product: { ...product, demo: false },
          variant,
          reason,
        })
      ).id;
      const result = await productDetail(token, pid);
      vid = result.product.variants[0].id;
      assert.equal(result.product.demo, true);
      assert.equal(result.product.variants[0].stock, 0);
      assert.equal(result.audits.length, 2);
      assert.equal(
        (await listProducts(token, { query: variant.sku })).products[0].id,
        pid,
      );
      await assert.rejects(
        () => createProduct(token, { product, variant, reason }),
        { code: "DUPLICATE" },
      );
    },
  );
  await check(
    "ediciones concurrentes no sobrescriben cambios y auditan solo la ganadora",
    async () => {
      const before = await details();
      const results = await Promise.allSettled([
        editProduct(token, pid, {
          ...product,
          name: "Edición A",
          expectedVersion: before.version,
          reason,
        }),
        editProduct(token, pid, {
          ...product,
          name: "Edición B",
          expectedVersion: before.version,
          reason,
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
          .reason.code,
        "EDIT_CONFLICT",
      );
      assert.equal(
        await db.adminAudit.count({
          where: { entityId: pid, action: "PRODUCT_EDIT" },
        }),
        1,
      );
    },
  );
  await check(
    "ajuste de stock se registra una sola vez; precios y stock inválidos se rechazan",
    async () => {
      const v = (await details()).variants[0];
      await assert.rejects(() =>
        adjustStock(token, vid, {
          stock: -1,
          expectedVersion: v.version,
          reason,
        }),
      );
      await assert.rejects(() =>
        editVariant(token, vid, {
          ...variant,
          price: 0,
          expectedVersion: v.version,
          reason,
        }),
      );
      const results = await Promise.allSettled([
        adjustStock(token, vid, {
          stock: 5,
          expectedVersion: v.version,
          reason,
        }),
        adjustStock(token, vid, {
          stock: 5,
          expectedVersion: v.version,
          reason,
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await db.inventoryMovement.count({
          where: { variantId: vid, kind: "ADJUST" },
        }),
        1,
      );
      assert.equal(
        (
          await db.inventoryMovement.findFirstOrThrow({
            where: { variantId: vid, kind: "ADJUST" },
          })
        ).quantity,
        5,
      );
    },
  );
  await check(
    "reserva impide bajar stock; cambio de precio conserva importe histórico",
    async () => {
      const session = await db.visitorSession.create({
        data: {
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      const rate = "admin-rate-" + tag;
      await db.shippingRate.create({
        data: {
          id: rate,
          department: tag,
          city: tag,
          amount: 12000,
          active: true,
          demo: true,
        },
      });
      await setCartQuantity(session.id, { variantId: vid, quantity: 3 });
      const q = await quoteCart(session.id, {
        shippingRateId: rate,
        coupon: "",
      });
      const order = await createOrder(session.id, {
        shippingRateId: rate,
        coupon: "",
        quoteHash: q.quoteHash,
        idempotencyKey: randomUUID(),
        acceptedDemo: true,
        recipient: {
          name: "Cliente de ejemplo",
          email: "example@example.invalid",
          phone: "3000000000",
          address: "Dirección ficticia 123",
          additional: "",
        },
      });
      const v = (await details()).variants[0],
        audits = await db.adminAudit.count({ where: { entityId: vid } });
      await assert.rejects(
        () =>
          adjustStock(token, vid, {
            stock: 2,
            expectedVersion: v.version,
            reason,
          }),
        { code: "RESERVED_STOCK" },
      );
      assert.equal(
        await db.adminAudit.count({ where: { entityId: vid } }),
        audits,
      );
      await editVariant(token, vid, {
        ...variant,
        price: 120000,
        expectedVersion: v.version,
        reason,
      });
      assert.equal(
        (await db.order.findUniqueOrThrow({ where: { id: order.id } })).total,
        312000,
      );
      await cancelOrder(session.id, order.id);
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: vid } })).reserved,
        0,
      );
    },
  );
  await check(
    "ocultar conserva relaciones e historial y retira el producto del catálogo",
    async () => {
      const p = await details();
      await assert.rejects(
        () =>
          editVariant(token, vid, {
            ...variant,
            active: false,
            expectedVersion: p.variants[0].version,
            reason,
          }),
        { code: "LAST_VARIANT" },
      );
      await editProduct(token, pid, {
        ...product,
        active: false,
        expectedVersion: p.version,
        reason,
      });
      assert.ok(!(await catalog()).some((p) => p.id === pid));
      const v = (await details()).variants[0];
      await editVariant(token, vid, {
        ...variant,
        active: false,
        expectedVersion: v.version,
        reason,
      });
      const hidden = await details();
      await assert.rejects(
        () =>
          editProduct(token, pid, {
            ...product,
            expectedVersion: hidden.version,
            reason,
          }),
        { code: "NO_VARIANTS" },
      );
      assert.ok((await db.orderItem.count({ where: { variantId: vid } })) > 0);
      await createVariant(token, pid, {
        ...variant,
        sku: variant.sku + "_2",
        label: "60 cm",
        reason,
      });
      await editProduct(token, pid, {
        ...product,
        expectedVersion: hidden.version,
        reason,
      });
      assert.ok((await catalog()).some((p) => p.id === pid));
    },
  );
  await check(
    "SKU duplicado revierte edición y no agrega auditoría",
    async () => {
      const p = await details(),
        v = p.variants.find((v) => v.id === vid)!,
        count = await db.adminAudit.count({ where: { entityId: vid } });
      await assert.rejects(
        () =>
          editVariant(token, vid, {
            ...variant,
            sku: variant.sku + "_2",
            expectedVersion: v.version,
            reason,
          }),
        { code: "DUPLICATE" },
      );
      assert.equal(
        await db.adminAudit.count({ where: { entityId: vid } }),
        count,
      );
      assert.equal(
        (await details()).variants.find((v) => v.id === vid)!.sku,
        variant.sku,
      );
    },
  );
  await check(
    "reserva y reducción simultáneas de la última unidad no se pisan",
    async () => {
      const v = (await details()).variants.find((v) => v.active)!;
      await adjustStock(token, v.id, {
        stock: 1,
        expectedVersion: v.version,
        reason,
      });
      const latest = (await details()).variants.find(
        (item) => item.id === v.id,
      )!;
      const visitor = await db.visitorSession.create({
        data: {
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      await setCartQuantity(visitor.id, { variantId: v.id, quantity: 1 });
      const shippingRateId = "admin-rate-" + tag;
      const quote = await quoteCart(visitor.id, { shippingRateId, coupon: "" });
      const results = await Promise.allSettled([
        adjustStock(token, v.id, {
          stock: 0,
          expectedVersion: latest.version,
          reason,
        }),
        createOrder(visitor.id, {
          shippingRateId,
          coupon: "",
          quoteHash: quote.quoteHash,
          idempotencyKey: randomUUID(),
          acceptedDemo: true,
          recipient: {
            name: "Cliente ficticio",
            email: "race@example.invalid",
            phone: "3000000000",
            address: "Dirección ficticia 123",
            additional: "",
          },
        }),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const rejected = results.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      assert.ok(
        ["OUT_OF_STOCK", "RESERVED_STOCK"].includes(rejected.reason.code),
      );
      const stored = await db.variant.findUniqueOrThrow({
        where: { id: v.id },
      });
      assert.ok(stored.stock >= stored.reserved);
      const orders = await db.order.findMany({
        where: { sessionId: visitor.id },
      });
      for (const order of orders) await cancelOrder(visitor.id, order.id);
    },
  );
  await check(
    "revocar rol invalida sesiones y el panel cierra fuera de desarrollo",
    async () => {
      await changeDevelopmentRole(email, "revoke");
      assert.equal(await authenticate(token), null);
      await assert.rejects(() => listProducts(token, {}), {
        code: "AUTH_REQUIRED",
      });
      process.env.APP_ENV = "production";
      await assert.rejects(() => listProducts(token, {}), {
        code: "ACCOUNTS_CLOSED",
      });
    },
  );
  console.log(count + " grupos de pruebas administrativas aprobados.");
} finally {
  await db.$disconnect();
}
