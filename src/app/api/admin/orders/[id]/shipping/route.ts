import { authToken } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { updateShipment } from "@/modules/shipping/service";
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(
      await updateShipment(
        token,
        (await ctx.params).id,
        await jsonBody(request),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
