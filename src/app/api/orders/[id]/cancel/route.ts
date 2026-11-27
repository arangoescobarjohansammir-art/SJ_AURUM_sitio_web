import { assertOrigin, visitor, response, failure, limit } from "@/lib/http";
import { cancelOrder } from "@/modules/commerce/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const session = await visitor();
    await limit(`cancel:${session}`, 20);
    const { id } = await params;
    const order = await cancelOrder(session, id);
    return response({ id: order.id, status: order.status });
  } catch (error) {
    return failure(error);
  }
}
