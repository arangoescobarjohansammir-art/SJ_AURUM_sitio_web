import "dotenv/config";
import { getDb } from "../src/lib/db";
const db = getDb();
try {
  console.log(
    await db.mailOutbox.groupBy({ by: ["status", "mode"], _count: true }),
  );
  console.log(
    await db.mailOutbox.findMany({
      where: { status: "FAILED" },
      select: { id: true, lastError: true, attempts: true, createdAt: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  );
} finally {
  await db.$disconnect();
}
