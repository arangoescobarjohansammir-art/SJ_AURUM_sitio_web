import { authToken } from "@/lib/auth-http";
import { assertOrigin, jsonBody, response, failure, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { editVariant } from "@/modules/admin/service";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(
      await editVariant(token, (await params).id, await jsonBody(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
