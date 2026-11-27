import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const origin = "http://127.0.0.1:3000",
  email = "http-" + randomUUID() + "@example.invalid",
  password = "Prueba " + randomUUID();
function client() {
  const jar = new Map();
  return {
    jar,
    async call(path, method = "GET", body) {
      const response = await fetch(origin + path, {
        method,
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          Cookie: [...jar].map(([k, v]) => k + "=" + v).join(";"),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";"),
          index = pair.indexOf("=");
        jar.set(pair.slice(0, index), pair.slice(index + 1));
      }
      return {
        status: response.status,
        data: await response.json(),
        headers: response.headers,
      };
    },
  };
}
async function mail(kind) {
  const dir = process.env.LOCAL_MAIL_DIRECTORY;
  if (!dir) throw Error("Configura LOCAL_MAIL_DIRECTORY");
  for (const file of await readdir(dir)) {
    const data = JSON.parse(await readFile(join(dir, file), "utf8"));
    if (data.to === email && data.kind === kind)
      return new URLSearchParams(new URL(data.url).hash.slice(1)).get("token");
  }
  throw Error("Missing local delivery");
}
const user = client(),
  anonymous = client();
assert.equal((await user.call("/api/account")).status, 401);
assert.equal(
  (
    await user.call("/api/auth/register", "POST", {
      name: "Test",
      email,
      password: "short",
      acceptedDemo: true,
    })
  ).status,
  400,
);
assert.equal(
  (
    await user.call("/api/auth/register", "POST", {
      name: "Cliente HTTP",
      email,
      password,
      acceptedDemo: true,
      role: "ADMIN",
    })
  ).status,
  202,
);
const verify = await mail("VERIFY");
assert.equal(
  (await user.call("/api/auth/verify", "POST", { token: verify })).status,
  200,
);
assert.equal(
  (await user.call("/api/auth/verify", "POST", { token: verify })).status,
  400,
);
assert.equal(
  (
    await user.call("/api/auth/login", "POST", {
      email,
      password: "incorrecta",
    })
  ).status,
  401,
);
const signed = await user.call("/api/auth/login", "POST", { email, password });
assert.equal(signed.status, 200);
assert.ok(
  signed.headers
    .getSetCookie()
    .some(
      (c) =>
        c.startsWith("aurum_account=") &&
        c.includes("HttpOnly") &&
        c.includes("SameSite=strict"),
    ),
);
let profile = await user.call("/api/account");
assert.equal(profile.data.customer.email, email);
assert.equal(profile.data.customer.role, "CUSTOMER");
assert.ok(profile.data.customer.verifiedAt);
assert.ok(!JSON.stringify(profile.data).includes("passwordHash"));
assert.equal(
  (
    await user.call("/api/account", "PATCH", {
      name: "Nombre actualizado",
      role: "ADMIN",
    })
  ).status,
  200,
);
assert.equal((await user.call("/api/account")).data.customer.role, "CUSTOMER");
const address = {
  label: "Casa de prueba",
  recipient: "Persona ficticia",
  phone: "3000000000",
  department: "Bogotá D.C.",
  city: "Bogotá",
  street: "Dirección ficticia 123",
  additional: "No enviar",
};
assert.equal(
  (await user.call("/api/account/addresses", "POST", address)).status,
  201,
);
const addresses = (await user.call("/api/account/addresses")).data.addresses;
assert.equal(addresses.length, 1);
assert.equal(
  (
    await anonymous.call(
      "/api/account/addresses/" + addresses[0].id,
      "DELETE",
      {},
    )
  ).status,
  401,
);
assert.equal(
  (
    await user.call("/api/account/addresses/" + addresses[0].id, "PATCH", {
      ...address,
      label: "Editada",
    })
  ).status,
  200,
);
assert.equal(
  (await user.call("/api/account/addresses/" + addresses[0].id, "DELETE", {}))
    .status,
  200,
);
const stale = user.jar.get("aurum_account");
assert.equal(
  (await user.call("/api/auth/request-reset", "POST", { email })).status,
  202,
);
const reset = await mail("RESET"),
  nextPassword = "Recuperada " + randomUUID();
assert.equal(
  (
    await user.call("/api/auth/reset", "POST", {
      token: reset,
      password: nextPassword,
    })
  ).status,
  200,
);
anonymous.jar.set("aurum_account", stale);
assert.equal((await anonymous.call("/api/account")).status, 401);
assert.equal(
  (
    await user.call("/api/auth/login", "POST", {
      email,
      password: nextPassword,
    })
  ).status,
  200,
);
assert.equal((await user.call("/api/auth/logout", "POST", {})).status, 200);
assert.equal((await user.call("/api/account")).status, 401);
console.log(
  "PASS HTTP cuentas: validación, registro, bandeja local, verificación de un uso, login, cookie, perfil/rol, direcciones privadas, recuperación y revocación.",
);
