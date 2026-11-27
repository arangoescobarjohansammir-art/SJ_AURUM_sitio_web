import { authToken } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import { listRates, saveRate } from "@/modules/shipping/service";
export async function GET() {
  try {
    return response({ rates: await listRates(await authToken()) });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("admin:" + actor.id, 40);
    return response(await saveRate(token, await jsonBody(request)));
  } catch (e) {
    return failure(e);
  }
}
