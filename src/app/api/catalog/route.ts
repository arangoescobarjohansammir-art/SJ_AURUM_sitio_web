import { response, failure } from "@/lib/http";
import { catalog, releaseExpired } from "@/modules/commerce/service";
export async function GET() {
  try {
    await releaseExpired();
    return response({ products: await catalog() });
  } catch (error) {
    return failure(error);
  }
}
