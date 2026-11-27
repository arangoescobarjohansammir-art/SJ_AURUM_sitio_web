import { account } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { saveAddress, deleteAddress } from "@/modules/auth/service";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const user = await account();
    await limit("addresses:" + user.id, 20);
    return response(
      await saveAddress(user.id, await jsonBody(request), (await params).id),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const user = await account();
    await limit("addresses:" + user.id, 20);
    return response(await deleteAddress(user.id, (await params).id));
  } catch (error) {
    return failure(error);
  }
}
