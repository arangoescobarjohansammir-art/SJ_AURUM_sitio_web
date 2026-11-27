import { authToken } from "@/lib/auth-http";
import { assertOrigin, jsonBody, response, failure, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { createVariant } from "@/modules/admin/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(
      await createVariant(token, (await params).id, await jsonBody(request)),
      201,
    );
  } catch (e) {
    return failure(e);
  }
}
