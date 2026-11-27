import { authToken } from "@/lib/auth-http";
import { response, failure } from "@/lib/http";
import { listAdminOrders } from "@/modules/admin/orders-service";
export async function GET(request: Request) {
  try {
    return response(
      await listAdminOrders(
        await authToken(),
        Object.fromEntries(new URL(request.url).searchParams),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
