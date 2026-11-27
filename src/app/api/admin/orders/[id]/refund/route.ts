import { authToken } from "@/lib/auth-http";
import { assertOrigin, jsonBody, response, failure, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { refundPayment } from "@/modules/payments/service";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const token = await authToken();
    const admin = await requireAdmin(token);
    await limit("refund-admin:" + admin.id, 5);
    return response(
      await refundPayment(
        token,
        (await context.params).id,
        await jsonBody(request),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
