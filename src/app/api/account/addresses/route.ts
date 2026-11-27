import { account } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { getDb } from "@/lib/db";
import { saveAddress } from "@/modules/auth/service";
export async function GET() {
  try {
    const user = await account();
    return response({
      addresses: await getDb().address.findMany({
        where: { customerId: user.id },
        select: {
          id: true,
          label: true,
          recipient: true,
          phone: true,
          department: true,
          city: true,
          street: true,
          additional: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const user = await account();
    await limit("addresses:" + user.id, 20);
    return response(await saveAddress(user.id, await jsonBody(request)), 201);
  } catch (error) {
    return failure(error);
  }
}
