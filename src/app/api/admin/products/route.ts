import { authToken } from "@/lib/auth-http";
import { assertOrigin, jsonBody, response, failure, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { listProducts, createProduct } from "@/modules/admin/service";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return response(
      await listProducts(await authToken(), {
        query: url.searchParams.get("query") ?? "",
        page: url.searchParams.get("page") ?? "1",
      }),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(await createProduct(token, await jsonBody(request)), 201);
  } catch (e) {
    return failure(e);
  }
}
