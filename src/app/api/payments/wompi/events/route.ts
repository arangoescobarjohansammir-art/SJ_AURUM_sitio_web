import { jsonBody, response, failure } from "@/lib/http";
import { receiveEvent } from "@/modules/payments/service";
export async function POST(request: Request) {
  try {
    return response(await receiveEvent(await jsonBody(request)));
  } catch (e) {
    return failure(e);
  }
}
