import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { getDb } from "../src/lib/db";
import {
  register,
  login,
  logout,
  authenticate,
  issueToken,
  consumeToken,
  saveAddress,
  deleteAddress,
  requireAdmin,
  updateProfile,
} from "../src/modules/auth/service";
import {
  newToken,
  tokenHash,
  verifyPassword,
} from "../src/modules/auth/password";
import {
  setCartQuantity,
  getCart,
  quoteCart,
  createOrder,
  listOrders,
  cancelOrder,
} from "../src/modules/commerce/service";
const url = new URL(process.env.DATABASE_URL ?? "");
if (url.hostname !== "127.0.0.1" || url.port !== "55432")
  throw Error("Solo PostgreSQL local de pruebas");
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
  email = "auth-" + tag + "@example.invalid",
  password = "Prueba exclusiva " + randomUUID();
let count = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  count++;
  console.log("PASS " + name);
}
let uid = "",
  token = "",
  cartId = "",
  addressId = "";
try {
  await check(
    "registro normaliza correo, no permite rol y guarda hash con sal",
    async () => {
      const user = await register({
        name: "Cliente de pruebas",
        email: email.toUpperCase(),
        password,
        acceptedDemo: true,
        role: "ADMIN",
      });
      assert.ok(user);
      uid = user.id;
      assert.equal(user.email, email);
      assert.equal(user.role, "CUSTOMER");
      const stored = await db.customer.findUniqueOrThrow({
        where: { id: uid },
      });
      cartId = stored.cartSessionId;
      assert.notEqual(stored.passwordHash, password);
      assert.ok(await verifyPassword(password, stored.passwordHash));
      assert.equal(
        await register({ name: "Otro", email, password, acceptedDemo: true }),
        null,
      );
    },
  );
  await check(
    "login inválido y usuario ausente dan el mismo error; token no se guarda en claro",
    async () => {
      await assert.rejects(() => login({ email, password: "incorrecta" }), {
        code: "INVALID_LOGIN",
      });
      await assert.rejects(
        () => login({ email: "missing-" + email, password }),
        { code: "INVALID_LOGIN" },
      );
      token = (await login({ email, password })).token;
      assert.equal((await authenticate(token))?.customer.id, uid);
      assert.equal(
        await db.authSession.count({ where: { tokenHash: token } }),
        0,
      );
    },
  );
  await check(
    "cliente no obtiene administración ni modifica su rol desde perfil",
    async () => {
      await assert.rejects(() => requireAdmin(token), { code: "FORBIDDEN" });
      await updateProfile(uid, { name: "Nombre actualizado", role: "ADMIN" });
      assert.equal((await authenticate(token))?.customer.role, "CUSTOMER");
    },
  );
  await check("verificación de un solo uso y propósito correcto", async () => {
    const link = await issueToken(email, "VERIFY");
    assert.ok(link);
    await assert.rejects(
      () => consumeToken({ token: link.token, password }, "RESET"),
      { code: "INVALID_TOKEN" },
    );
    const results = await Promise.allSettled([
      consumeToken({ token: link.token }, "VERIFY"),
      consumeToken({ token: link.token }, "VERIFY"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.ok((await authenticate(token))?.customer.verifiedAt);
  });
  await check(
    "direcciones ajenas no pueden editarse ni eliminarse",
    async () => {
      const address = {
        label: "Casa ficticia",
        recipient: "Persona de prueba",
        phone: "3000000000",
        department: "Antioquia",
        city: "Medellín",
        street: "Dirección ficticia 123",
        additional: "No enviar",
      };
      await saveAddress(uid, address);
      addressId = (
        await db.address.findFirstOrThrow({ where: { customerId: uid } })
      ).id;
      const other = await register({
        name: "Otra cuenta",
        email: "other-" + email,
        password,
        acceptedDemo: true,
      });
      assert.ok(other);
      await assert.rejects(() => saveAddress(other.id, address, addressId), {
        code: "NOT_FOUND",
      });
      await assert.rejects(() => deleteAddress(other.id, addressId), {
        code: "NOT_FOUND",
      });
      await saveAddress(uid, { ...address, label: "Editada" }, addressId);
      assert.equal(
        (await db.address.findUniqueOrThrow({ where: { id: addressId } }))
          .label,
        "Editada",
      );
    },
  );
  await check(
    "enlace vencido se rechaza; recuperación revoca todas las sesiones",
    async () => {
      const expired = await issueToken(email, "RESET");
      assert.ok(expired);
      await db.accountToken.update({
        where: { tokenHash: tokenHash(expired.token) },
        data: { expiresAt: new Date(0) },
      });
      await assert.rejects(
        () => consumeToken({ token: expired.token, password }, "RESET"),
        { code: "INVALID_TOKEN" },
      );
      const link = await issueToken(email, "RESET");
      assert.ok(link);
      const second = (await login({ email, password })).token,
        newPassword = "Nueva contraseña " + randomUUID();
      await consumeToken({ token: link.token, password: newPassword }, "RESET");
      assert.equal(await authenticate(token), null);
      assert.equal(await authenticate(second), null);
      await assert.rejects(
        () =>
          consumeToken({ token: link.token, password: newPassword }, "RESET"),
        { code: "INVALID_TOKEN" },
      );
      await assert.rejects(() => login({ email, password }), {
        code: "INVALID_LOGIN",
      });
      token = (await login({ email, password: newPassword })).token;
      await logout(token);
      assert.equal(await authenticate(token), null);
    },
  );
  await check(
    "bolsa y pedidos invitados migran una vez; cookie anterior queda invalidada",
    async () => {
      const guestToken = newToken(),
        guest = await db.visitorSession.create({
          data: {
            tokenHash: tokenHash(guestToken),
            expiresAt: new Date(Date.now() + 86400000),
          },
        });
      const p = "auth-product-" + tag,
        rate = "auth-rate-" + tag;
      await db.product.create({
        data: {
          id: p,
          slug: p,
          name: "Prueba",
          category: "Cadenas",
          description: "Ejemplo",
          image: "/images/product-1.jpg",
          gallery: [],
          active: true,
          demo: true,
          variants: {
            create: { id: p, sku: p, label: "Única", price: 100000, stock: 5 },
          },
        },
      });
      await db.shippingRate.create({
        data: {
          id: rate,
          department: tag,
          city: tag,
          amount: 10000,
          active: true,
          demo: true,
        },
      });
      await setCartQuantity(guest.id, { variantId: p, quantity: 1 });
      const quote = await quoteCart(guest.id, {
        shippingRateId: rate,
        coupon: "",
      });
      const order = await createOrder(guest.id, {
        shippingRateId: rate,
        coupon: "",
        quoteHash: quote.quoteHash,
        idempotencyKey: randomUUID(),
        acceptedDemo: true,
        recipient: {
          name: "Persona ficticia",
          email: "test@example.invalid",
          phone: "3000000000",
          address: "Dirección de ejemplo",
          additional: "",
        },
      });
      await setCartQuantity(guest.id, { variantId: p, quantity: 2 });
      const buyerEmail = "buyer-" + email;
      const buyer = await register({
        name: "Comprador",
        email: buyerEmail,
        password,
        acceptedDemo: true,
      });
      assert.ok(buyer);
      const buyerRecord = await db.customer.findUniqueOrThrow({
        where: { id: buyer.id },
      });
      await setCartQuantity(buyerRecord.cartSessionId, {
        variantId: p,
        quantity: 3,
      });
      const [a, b] = await Promise.all([
        login({ email: buyerEmail, password }, guestToken),
        login({ email: buyerEmail, password }, guestToken),
      ]);
      assert.ok(a.adjusted || b.adjusted);
      assert.equal((await getCart(buyerRecord.cartSessionId))[0].quantity, 4);
      assert.equal(
        await db.visitorSession.count({
          where: { tokenHash: tokenHash(guestToken) },
        }),
        0,
      );
      assert.equal(
        (await listOrders(buyerRecord.cartSessionId))[0].id,
        order.id,
      );
      assert.equal((await listOrders(guest.id)).length, 0);
      await assert.rejects(() => cancelOrder(cartId, order.id), {
        code: "NOT_FOUND",
      });
      await cancelOrder(buyerRecord.cartSessionId, order.id);
      assert.equal(
        (await db.variant.findUniqueOrThrow({ where: { id: p } })).reserved,
        0,
      );
    },
  );
  await check(
    "sesión vencida o cuenta desactivada no autentica; producción cerrado",
    async () => {
      const user = await register({
        name: "Temporal",
        email: "temp-" + email,
        password,
        acceptedDemo: true,
      });
      assert.ok(user);
      const signed = await login({ email: user.email, password });
      await db.authSession.update({
        where: { tokenHash: tokenHash(signed.token) },
        data: { expiresAt: new Date(0) },
      });
      assert.equal(await authenticate(signed.token), null);
      const active = await login({ email: user.email, password });
      await db.customer.update({
        where: { id: user.id },
        data: { active: false },
      });
      assert.equal(await authenticate(active.token), null);
      process.env.APP_ENV = "production";
      await assert.rejects(() => register({}), { code: "ACCOUNTS_CLOSED" });
      assert.equal(await authenticate(active.token), null);
      process.env.APP_ENV = "development";
    },
  );
  console.log(count + " pruebas de cuentas aprobadas.");
} finally {
  await db.$disconnect();
}
