import { assertOrigin, visitor, response, failure } from "@/lib/http";
import { getCart } from "@/modules/commerce/service";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await visitor(true);
    return response({ cart: await getCart(id) });
  } catch (error) {
    return failure(error);
  }
}
