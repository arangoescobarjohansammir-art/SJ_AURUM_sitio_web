import { getDb } from "../../lib/db";
import { CommerceError, transaction } from "../commerce/service";
import {
  hashPassword,
  verifyPassword,
  dummyHash,
  newToken,
  tokenHash,
} from "./password";
import {
  registerSchema,
  loginSchema,
  resetSchema,
  tokenSchema,
  profileSchema,
  addressSchema,
  emailSchema,
} from "./validation";
import type { Prisma } from "../../generated/prisma/client";
export function requireDevelopmentAccounts() {
  if (process.env.APP_ENV !== "development")
    throw new CommerceError(
      "ACCOUNTS_CLOSED",
      "Las cuentas de prueba solo están habilitadas en desarrollo.",
      503,
    );
}
export const publicCustomer = {
  id: true,
  name: true,
  email: true,
  verifiedAt: true,
  role: true,
} as const;
const unauthorized = () =>
  new CommerceError("AUTH_REQUIRED", "Inicia sesión para continuar.", 401);
async function lockCustomer(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT "id" FROM "Customer" WHERE "id"=${id} AND "active"=true FOR UPDATE`;
  if (!rows.length) throw unauthorized();
}
export async function register(input: unknown) {
  requireDevelopmentAccounts();
  const data = registerSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  try {
    return await getDb().customer.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        cartSession: {
          create: {
            tokenHash: tokenHash(newToken()),
            expiresAt: new Date("2100-01-01"),
          },
        },
      },
      select: publicCustomer,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}
export async function authenticate(token: string | undefined) {
  if (
    process.env.APP_ENV !== "development" ||
    !token ||
    !/^[a-f0-9]{64}$/.test(token)
  )
    return null;
  const session = await getDb().authSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { customer: true },
  });
  return session && session.expiresAt > new Date() && session.customer.active
    ? session
    : null;
}
export async function requireCustomer(token: string | undefined) {
  const session = await authenticate(token);
  if (!session) throw unauthorized();
  return session.customer;
}
export async function requireAdmin(token: string | undefined) {
  const customer = await requireCustomer(token);
  if (customer.role !== "ADMIN" || !customer.verifiedAt)
    throw new CommerceError(
      "FORBIDDEN",
      "No tienes permiso para esta operación.",
      403,
    );
  return customer;
}
async function mergeGuest(
  tx: Prisma.TransactionClient,
  guestToken: string | undefined,
  targetId: string,
) {
  if (!guestToken || !/^[a-f0-9]{64}$/.test(guestToken)) return false;
  const guest = await tx.visitorSession.findUnique({
    where: { tokenHash: tokenHash(guestToken) },
    include: { customer: { select: { id: true } } },
  });
  if (
    !guest ||
    guest.customer ||
    guest.expiresAt <= new Date() ||
    guest.id === targetId
  )
    return false;
  for (const id of [guest.id, targetId].sort())
    await tx.$queryRaw`SELECT "id" FROM "VisitorSession" WHERE "id"=${id} FOR UPDATE`;
  const current = await tx.visitorSession.findUniqueOrThrow({
    where: { id: guest.id },
  });
  if (
    current.tokenHash !== tokenHash(guestToken) ||
    current.expiresAt <= new Date()
  )
    return false;
  const lines = await tx.cartItem.findMany({
    where: { sessionId: guest.id },
    include: { variant: { include: { product: true } } },
  });
  let adjusted = false;
  for (const line of lines) {
    const v = line.variant;
    const existing = await tx.cartItem.findUnique({
      where: { sessionId_variantId: { sessionId: targetId, variantId: v.id } },
    });
    if (
      !v.active ||
      !v.product.active ||
      !v.product.demo ||
      v.stock <= v.reserved
    ) {
      adjusted = true;
      continue;
    }
    if (
      !existing &&
      (await tx.cartItem.count({ where: { sessionId: targetId } })) >= 30
    ) {
      adjusted = true;
      continue;
    }
    const desired = (existing?.quantity ?? 0) + line.quantity,
      quantity = Math.min(99, desired, v.stock - v.reserved);
    if (quantity < desired) adjusted = true;
    await tx.cartItem.upsert({
      where: { sessionId_variantId: { sessionId: targetId, variantId: v.id } },
      create: { sessionId: targetId, variantId: v.id, quantity },
      update: { quantity },
    });
  }
  await tx.order.updateMany({
    where: { sessionId: guest.id },
    data: { sessionId: targetId },
  });
  await tx.cartItem.deleteMany({ where: { sessionId: guest.id } });
  await tx.visitorSession.update({
    where: { id: guest.id },
    data: { tokenHash: tokenHash(newToken()), expiresAt: new Date(0) },
  });
  return adjusted;
}
export async function login(input: unknown, guestToken?: string) {
  requireDevelopmentAccounts();
  const data = loginSchema.parse(input);
  const user = await getDb().customer.findUnique({
    where: { email: data.email },
  });
  const valid = await verifyPassword(
    data.password,
    user?.passwordHash ?? dummyHash,
  );
  if (!user || !user.active || !valid)
    throw new CommerceError(
      "INVALID_LOGIN",
      "Correo o contraseña incorrectos.",
      401,
    );
  const token = newToken();
  return transaction(async (tx) => {
    await lockCustomer(tx, user.id);
    const fresh = await tx.customer.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (fresh.passwordHash !== user.passwordHash)
      throw new CommerceError(
        "INVALID_LOGIN",
        "Correo o contraseña incorrectos.",
        401,
      );
    const adjusted = await mergeGuest(tx, guestToken, user.cartSessionId);
    await tx.authSession.create({
      data: {
        customerId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return { token, adjusted };
  });
}
export async function logout(token: string | undefined) {
  if (token)
    await getDb().authSession.deleteMany({
      where: { tokenHash: tokenHash(token) },
    });
}
export async function issueToken(email: unknown, kind: "VERIFY" | "RESET") {
  requireDevelopmentAccounts();
  const normalized = emailSchema.parse(email),
    token = newToken();
  const user = await getDb().customer.findUnique({
    where: { email: normalized },
  });
  if (!user || !user.active || (kind === "VERIFY" && user.verifiedAt))
    return null;
  return transaction(async (tx) => {
    await lockCustomer(tx, user.id);
    await tx.accountToken.updateMany({
      where: { customerId: user.id, kind, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.accountToken.create({
      data: {
        customerId: user.id,
        tokenHash: tokenHash(token),
        kind,
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
    return { token, email: normalized, kind };
  });
}
export async function consumeToken(input: unknown, kind: "VERIFY" | "RESET") {
  requireDevelopmentAccounts();
  const data =
    kind === "RESET"
      ? resetSchema.parse(input)
      : {
          token: tokenSchema.parse((input as { token?: unknown })?.token),
          password: undefined,
        };
  const nextHash = data.password ? await hashPassword(data.password) : null;
  return transaction(async (tx) => {
    const record = await tx.accountToken.findUnique({
      where: { tokenHash: tokenHash(data.token) },
    });
    if (!record || record.kind !== kind)
      throw new CommerceError(
        "INVALID_TOKEN",
        "El enlace no es válido o ha vencido.",
        400,
      );
    await lockCustomer(tx, record.customerId);
    const consumed = await tx.accountToken.updateMany({
      where: {
        id: record.id,
        kind,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1)
      throw new CommerceError(
        "INVALID_TOKEN",
        "El enlace no es válido o ha vencido.",
        400,
      );
    await tx.customer.update({
      where: { id: record.customerId },
      data:
        kind === "VERIFY"
          ? { verifiedAt: new Date() }
          : { passwordHash: nextHash! },
    });
    if (kind === "RESET") {
      await tx.authSession.deleteMany({
        where: { customerId: record.customerId },
      });
      await tx.accountToken.updateMany({
        where: { customerId: record.customerId, kind: "RESET", usedAt: null },
        data: { usedAt: new Date() },
      });
    }
    return { ok: true };
  });
}
export async function updateProfile(customerId: string, input: unknown) {
  const data = profileSchema.parse(input);
  return getDb().customer.update({
    where: { id: customerId },
    data,
    select: publicCustomer,
  });
}
export async function saveAddress(
  customerId: string,
  input: unknown,
  id?: string,
) {
  const data = addressSchema.parse(input);
  return transaction(async (tx) => {
    await lockCustomer(tx, customerId);
    if (id) {
      const changed = await tx.address.updateMany({
        where: { id, customerId },
        data,
      });
      if (!changed.count)
        throw new CommerceError("NOT_FOUND", "Dirección no encontrada.", 404);
    } else {
      if ((await tx.address.count({ where: { customerId } })) >= 5)
        throw new CommerceError(
          "ADDRESS_LIMIT",
          "Puedes guardar hasta cinco direcciones.",
          400,
        );
      await tx.address.create({ data: { ...data, customerId } });
    }
    return { ok: true };
  });
}
export async function deleteAddress(customerId: string, id: string) {
  const result = await getDb().address.deleteMany({
    where: { id, customerId },
  });
  if (!result.count)
    throw new CommerceError("NOT_FOUND", "Dirección no encontrada.", 404);
  return { ok: true };
}
