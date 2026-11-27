import { authToken } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import {
  adminOrderDetail,
  changeAdminOrder,
} from "@/modules/admin/orders-service";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, ctx: Context) {
  try {
    return response(
      await adminOrderDetail(await authToken(), (await ctx.params).id),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request, ctx: Context) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(
      await changeAdminOrder(
        token,
        (await ctx.params).id,
        await jsonBody(request),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
