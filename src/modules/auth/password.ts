import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
const options = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return [
    "scrypt-v1",
    salt,
    (await derive(password, salt)).toString("hex"),
  ].join(":");
}
export async function verifyPassword(password: string, encoded: string) {
  const [version, salt, stored] = encoded.split(":");
  if (version !== "scrypt-v1" || !salt || !/^[a-f0-9]{128}$/.test(stored ?? ""))
    return false;
  return timingSafeEqual(
    await derive(password, salt),
    Buffer.from(stored, "hex"),
  );
}
export const dummyHash =
  "scrypt-v1:00000000000000000000000000000000:" + "0".repeat(128);
