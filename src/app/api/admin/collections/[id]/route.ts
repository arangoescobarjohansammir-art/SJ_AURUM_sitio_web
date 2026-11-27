import { authToken } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { saveCollection } from "@/modules/admin/catalog-service";
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(
      await saveCollection(
        token,
        await jsonBody(request),
        (await ctx.params).id,
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
