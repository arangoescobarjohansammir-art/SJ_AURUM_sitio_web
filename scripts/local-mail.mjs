import "dotenv/config";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Uso: npm run mail:local -- cliente@example.invalid");
  process.exit(1);
}
const dir = process.env.LOCAL_MAIL_DIRECTORY;
if (!dir) throw Error("Configura LOCAL_MAIL_DIRECTORY en .env");
let files = [];
try {
  files = await readdir(dir);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const messages = [];
for (const file of files.filter((name) => name.endsWith(".json"))) {
  const path = join(dir, file),
    data = JSON.parse(await readFile(path, "utf8"));
  if (data.to === email)
    messages.push({ ...data, time: (await stat(path)).mtimeMs });
}
messages.sort((a, b) => b.time - a.time);
const latest = messages[0];
if (!latest) console.log("No hay mensajes locales para este correo.");
else {
  console.log(
    "Solo desarrollo; este enlace da acceso a verificar o recuperar la cuenta. No lo compartas.",
  );
  console.log(latest.kind, latest.url);
}
