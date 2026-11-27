import { getDb } from "@/lib/db";
import { response, failure } from "@/lib/http";
export async function GET() {
  try {
    return response({
      rates: await getDb().shippingRate.findMany({
        where: { active: true, demo: true },
        select: { id: true, department: true, city: true, amount: true },
        orderBy: { city: "asc" },
      }),
    });
  } catch (error) {
    return failure(error);
  }
}
