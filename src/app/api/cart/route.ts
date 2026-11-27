import {
  assertOrigin,
  visitor,
  response,
  failure,
  jsonBody,
  limit,
} from "@/lib/http";
import { getCart, setCartQuantity } from "@/modules/commerce/service";
export async function GET() {
  try {
    return response({ cart: await getCart(await visitor()) });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertOrigin(request);
    const id = await visitor();
    await limit(`cart:${id}`, 60);
    return response({
      cart: await setCartQuantity(id, await jsonBody(request)),
    });
  } catch (error) {
    return failure(error);
  }
}
