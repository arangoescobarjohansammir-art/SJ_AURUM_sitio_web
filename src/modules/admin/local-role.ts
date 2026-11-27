import { getDb } from "../../lib/db";
import { transaction, CommerceError } from "../commerce/service";
import { requireDevelopmentAccounts } from "../auth/service";
import { emailSchema } from "../auth/validation";
// Local operator command only. Never import into an HTTP route.
export async function changeDevelopmentRole(email: unknown, action: string) {
  requireDevelopmentAccounts();
  const dbUrl = new URL(process.env.DATABASE_URL ?? "");
  if (
    dbUrl.hostname !== "127.0.0.1" ||
    dbUrl.port !== "55432" ||
    !["/aurum_dev", "/aurum_test"].includes(dbUrl.pathname)
  )
    throw Error(
      "Role setup only supports the named local development databases",
    );
  if (action !== "grant" && action !== "revoke")
    throw Error("Use grant or revoke");
  const normalized = emailSchema.parse(email);
  return transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Customer" WHERE "email"=${normalized} FOR UPDATE`;
    if (!rows.length)
      throw new CommerceError("NOT_FOUND", "Registra primero la cuenta.", 404);
    const user = await tx.customer.findUniqueOrThrow({
      where: { id: rows[0].id },
    });
    if (action === "grant" && (!user.active || !user.verifiedAt))
      throw new CommerceError(
        "NOT_VERIFIED",
        "La cuenta debe estar activa y verificada.",
        403,
      );
    const role = action === "grant" ? "ADMIN" : "CUSTOMER";
    if (user.role === role) return { changed: false };
    await tx.customer.update({ where: { id: user.id }, data: { role } });
    await tx.authSession.deleteMany({ where: { customerId: user.id } });
    await tx.adminAudit.create({
      data: {
        actorId: user.id,
        action: "LOCAL_ROLE_CHANGE",
        entityId: user.id,
        before: { role: user.role },
        after: { role },
        reason: "Operador local: " + action + "; sesiones revocadas",
      },
    });
    return { changed: true };
  });
}
