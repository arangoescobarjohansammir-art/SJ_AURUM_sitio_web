import "dotenv/config";
import { getDb } from "../src/lib/db";
import { paymentConfig, fetchTransaction } from "../src/modules/payments/wompi";
import { applyTransaction } from "../src/modules/payments/service";
paymentConfig();
const db = getDb();
try {
  const payments = await db.payment.findMany({
    where: {
      transactionId: { not: null },
      status: { in: ["CREATED", "PENDING", "APPROVED"] },
      order: { status: { not: "REFUNDED" } },
    },
    orderBy: { checkedAt: { sort: "asc", nulls: "first" } },
    take: 100,
  });
  let checked = 0,
    failed = 0;
  for (const payment of payments) {
    try {
      await applyTransaction(await fetchTransaction(payment.transactionId!));
      checked++;
    } catch {
      failed++;
    }
  }
  console.log(
    JSON.stringify({
      checked,
      failed,
      note: "Solo transacciones conocidas; las que no regresaron necesitan webhook. No reenvía reembolsos.",
    }),
  );
  if (failed) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
