import {
  assertOrigin,
  visitor,
  response,
  failure,
  jsonBody,
  limit,
} from "@/lib/http";
import { quoteCart, releaseExpired } from "@/modules/commerce/service";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await visitor();
    await limit(`quote:${id}`);
    await releaseExpired();
    return response(await quoteCart(id, await jsonBody(request)));
  } catch (error) {
    return failure(error);
  }
}
