import { authToken } from "@/lib/auth-http";
import { response, failure, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { CommerceError } from "@/modules/commerce/service";
import {
  listMedia,
  uploadImage,
  maxImageBytes,
} from "@/modules/admin/catalog-service";
export async function GET() {
  try {
    return response({ assets: await listMedia(await authToken()) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const expected = process.env.APP_URL;
    if (!expected || request.headers.get("origin") !== new URL(expected).origin)
      throw new CommerceError(
        "ORIGIN_REJECTED",
        "La solicitud no proviene de la tienda.",
        403,
      );
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;"))
      throw new CommerceError(
        "CONTENT_TYPE",
        "Usa el formulario de carga de fotografías.",
        415,
      );
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("media:" + actor.id, 10);
    const reader = request.body?.getReader();
    if (!reader)
      throw new CommerceError("EMPTY_BODY", "Selecciona una fotografía.", 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxImageBytes + 65536) {
        await reader.cancel();
        throw new CommerceError(
          "BODY_TOO_LARGE",
          "El archivo supera 5 MB.",
          413,
        );
      }
      chunks.push(value);
    }
    let form: FormData;
    try {
      form = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": type },
      }).formData();
    } catch {
      throw new CommerceError(
        "INVALID_FORM",
        "No pudimos leer la fotografía.",
        400,
      );
    }
    const file = form.get("file"),
      label = form.get("label");
    if (
      !(file instanceof File) ||
      typeof label !== "string" ||
      form.getAll("file").length !== 1
    )
      throw new CommerceError(
        "INVALID_FORM",
        "Selecciona una fotografía y su descripción.",
        400,
      );
    return response(
      await uploadImage(token, Buffer.from(await file.arrayBuffer()), label),
      201,
    );
  } catch (e) {
    return failure(e);
  }
}
