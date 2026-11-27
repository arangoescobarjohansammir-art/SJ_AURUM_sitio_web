import "dotenv/config";
import { processMailBatch } from "../src/modules/mail/outbox";
import { getDb } from "../src/lib/db";
let stop = false;
process.on("SIGINT", () => {
  stop = true;
});
process.on("SIGTERM", () => {
  stop = true;
});
try {
  do {
    try {
      const result = await processMailBatch();
      if (result.sent || result.failed || !process.argv.includes("--watch"))
        console.log(JSON.stringify(result));
    } catch {
      console.error("MAIL_WORKER_ERROR");
      if (!process.argv.includes("--watch")) process.exitCode = 1;
    }
    if (!process.argv.includes("--watch") || stop) break;
    await new Promise((r) => setTimeout(r, 10000));
  } while (!stop);
} finally {
  await getDb().$disconnect();
}
