import { z } from "zod";
import {
  assertOrigin,
  visitor,
  limit,
  jsonBody,
  response,
  failure,
} from "@/lib/http";
import { syncPayment } from "@/modules/payments/service";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const session = await visitor();
    await limit("payment-sync:" + session, 15);
    const { id } = z
      .object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/) })
      .parse(await jsonBody(request));
    return response(await syncPayment(session, id));
  } catch (e) {
    return failure(e);
  }
}
