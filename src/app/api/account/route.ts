import { account } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { updateProfile } from "@/modules/auth/service";
export async function GET() {
  try {
    const user = await account();
    return response({
      customer: {
        id: user.id,
        name: user.name,
        email: user.email,
        verifiedAt: user.verifiedAt,
        role: user.role,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertOrigin(request);
    const user = await account();
    await limit("profile:" + user.id, 20);
    return response({
      customer: await updateProfile(user.id, await jsonBody(request)),
    });
  } catch (error) {
    return failure(error);
  }
}
