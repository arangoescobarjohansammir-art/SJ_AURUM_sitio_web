import { authToken } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import {
  listCollections,
  saveCollection,
} from "@/modules/admin/catalog-service";
export async function GET() {
  try {
    return response({ collections: await listCollections(await authToken()) });
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
    return response(await saveCollection(token, await jsonBody(request)), 201);
  } catch (e) {
    return failure(e);
  }
}
