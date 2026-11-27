import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
function exec(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `pg_ctl terminó con código ${code}. Revisa .local/postgres.log.`,
            ),
          ),
    );
  });
}

const directory = resolve(".local");
await mkdir(directory, { recursive: true });
const configPath = resolve(directory, "database.json");
let config;
try {
  config = JSON.parse(await readFile(configPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  config = {
    port: 55432,
    user: "aurum_dev",
    password: randomBytes(32).toString("hex"),
  };
  await writeFile(configPath, JSON.stringify(config), {
    mode: 0o600,
    flag: "wx",
  });
}
const dataDirectory = resolve(directory, "postgres");
const pg = new EmbeddedPostgres({
  databaseDir: dataDirectory,
  ...config,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (message) =>
    console.log(String(message).replaceAll(config.password, "[redactado]")),
  onError: (error) =>
    console.error(String(error).replaceAll(config.password, "[redactado]")),
});
try {
  await access(resolve(dataDirectory, "PG_VERSION"));
} catch {
  await pg.initialise();
}
let pgCtl;
if (process.platform === "win32") {
  const { postgres } = await import("@embedded-postgres/windows-x64");
  pgCtl = resolve(dirname(postgres), "pg_ctl.exe");
  await exec(
    pgCtl,
    [
      "start",
      "-D",
      dataDirectory,
      "-l",
      resolve(directory, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${config.port}`,
      "-w",
    ],
    { windowsHide: true },
  );
} else {
  await pg.start();
}
const client = pg.getPgClient();
await client.connect();
for (const name of ["aurum_dev", "aurum_test"]) {
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!result.rowCount) await client.query(`CREATE DATABASE "${name}"`);
}
await client.end();
try {
  await writeFile(
    ".env",
    `DATABASE_URL=postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/aurum_dev\nAPP_URL=http://127.0.0.1:3000\nAPP_ENV=development\nLOCAL_MAIL_DIRECTORY=.local/mail\nDEMO_CHECKOUT_ENABLED=true\nCOMMERCE_ENABLED=false\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Configuración local creada en .env (ignorada por Git). No se imprimen credenciales.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
console.log(
  "PostgreSQL de desarrollo activo solo en 127.0.0.1:55432. Ctrl+C para detener.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (pgCtl)
    await exec(pgCtl, ["stop", "-D", dataDirectory, "-m", "fast", "-w"], {
      windowsHide: true,
    });
  else await pg.stop();
  clearInterval(keepAlive);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const keepAlive = setInterval(() => {}, 60000);
