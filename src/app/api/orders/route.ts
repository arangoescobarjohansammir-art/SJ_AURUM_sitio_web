import {
  assertOrigin,
  visitor,
  response,
  failure,
  jsonBody,
  limit,
} from "@/lib/http";
import {
  createOrder,
  listOrders,
  releaseExpired,
} from "@/modules/commerce/service";
import { paymentsEnabled } from "@/modules/payments/wompi";
export async function GET() {
  try {
    const id = await visitor();
    await releaseExpired();
    return response({
      orders: await listOrders(id),
      paymentsEnabled: paymentsEnabled(),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await visitor();
    await limit(`orders:${id}`, 10);
    await releaseExpired();
    const order = await createOrder(id, await jsonBody(request));
    return response(
      {
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        demo: true,
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
