import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { getDb } from "./db";
import { CommerceError } from "../modules/commerce/service";

const cookieName = "aurum_visitor";
export function assertOrigin(request: Request) {
  const expected = process.env.APP_URL;
  if (!expected || request.headers.get("origin") !== new URL(expected).origin)
    throw new CommerceError(
      "ORIGIN_REJECTED",
      "La solicitud no proviene de la tienda.",
      403,
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new CommerceError("CONTENT_TYPE", "La solicitud debe ser JSON.", 415);
}
export async function jsonBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader)
    throw new CommerceError(
      "EMPTY_BODY",
      "Faltan los datos de la solicitud.",
      400,
    );
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new CommerceError(
        "BODY_TOO_LARGE",
        "La solicitud es demasiado grande.",
        413,
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CommerceError(
      "INVALID_JSON",
      "No se pudieron leer los datos.",
      400,
    );
  }
}
export async function limit(key: string, max = 30) {
  const rows = await getDb().$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,NOW()+INTERVAL '1 minute')
    ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt"<=NOW() THEN 1 ELSE "RateLimit"."count"+1 END,
    "expiresAt"=CASE WHEN "RateLimit"."expiresAt"<=NOW() THEN NOW()+INTERVAL '1 minute' ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > max)
    throw new CommerceError(
      "RATE_LIMIT",
      "Has realizado varias solicitudes. Espera un minuto.",
      429,
    );
}
export async function visitor(create = false) {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const session = await getDb().visitorSession.findUnique({
      where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    });
    if (session && session.expiresAt > new Date()) return session.id;
  }
  if (!create)
    throw new CommerceError(
      "SESSION_REQUIRED",
      "Recarga la página para recuperar una sesión válida.",
      401,
    );
  await limit("session-create", 120);
  const secret = randomBytes(32).toString("hex");
  const session = await getDb().visitorSession.create({
    data: {
      tokenHash: createHash("sha256").update(secret).digest("hex"),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    },
  });
  jar.set(cookieName, secret, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith("https://") ?? true,
    sameSite: "strict",
    path: "/",
    maxAge: 30 * 86400,
  });
  return session.id;
}
export function response(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof CommerceError)
    return response({ error: error.message, code: error.code }, error.status);
  if (error instanceof ZodError)
    return response(
      {
        error: "Revisa los campos indicados.",
        code: "VALIDATION",
        fields: error.flatten().fieldErrors,
      },
      400,
    );
  console.error(
    "AURUM request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return response(
    {
      error: "No pudimos completar la operación. Inténtalo de nuevo.",
      code: "SERVICE_UNAVAILABLE",
    },
    503,
  );
}
