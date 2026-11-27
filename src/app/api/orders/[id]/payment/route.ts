import { assertOrigin, visitor, limit, response, failure } from "@/lib/http";
import { startPayment } from "@/modules/payments/service";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const session = await visitor();
    await limit("payment-start:" + session, 10);
    return response(await startPayment(session, (await context.params).id));
  } catch (e) {
    return failure(e);
  }
}
