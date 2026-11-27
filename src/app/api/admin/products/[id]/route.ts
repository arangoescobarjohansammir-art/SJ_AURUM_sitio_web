import { authToken } from "@/lib/auth-http";
import { assertOrigin, jsonBody, response, failure, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { productDetail, editProduct } from "@/modules/admin/service";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return response(await productDetail(await authToken(), (await params).id));
  } catch (e) {
    return failure(e);
  }
}
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
      await editProduct(token, (await params).id, await jsonBody(request)),
    );
  } catch (e) {
    return failure(e);
  }
}
