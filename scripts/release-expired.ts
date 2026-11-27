import "dotenv/config";
import { releaseExpired } from "../src/modules/commerce/service";
import { getDb } from "../src/lib/db";
try {
  console.log(`Reservas vencidas procesadas: ${await releaseExpired()}`);
} finally {
  await getDb().$disconnect();
}
