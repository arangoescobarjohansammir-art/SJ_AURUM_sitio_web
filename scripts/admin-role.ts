import "dotenv/config";
import { changeDevelopmentRole } from "../src/modules/admin/local-role";
import { getDb } from "../src/lib/db";
try {
  const result = await changeDevelopmentRole(process.argv[3], process.argv[2]);
  console.log(
    result.changed
      ? "Rol actualizado y sesiones revocadas. Inicia sesión de nuevo."
      : "La cuenta ya tiene ese rol.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "No se pudo actualizar el rol.",
  );
  process.exitCode = 1;
} finally {
  await getDb().$disconnect();
}
