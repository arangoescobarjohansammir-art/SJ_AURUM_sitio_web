import { authToken } from "@/lib/auth-http";
import { response, failure, assertOrigin, jsonBody, limit } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/service";
import {
  enviaStatus,
  quoteEnvia,
  generateEnvia,
  trackEnvia,
} from "@/modules/shipping/envia-service";
import { z } from "zod";
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, ctx: Context) {
  try {
    return response(
      await enviaStatus(await authToken(), (await ctx.params).id),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request, ctx: Context) {
  try {
    assertOrigin(req);
    const token = await authToken(),
      actor = await requireAdmin(token);
    await limit("envia:" + actor.id, 15);
    const body = z
      .object({
        action: z.enum(["QUOTE", "GENERATE", "TRACK"]),
        data: z.unknown().optional(),
      })
      .parse(await jsonBody(req));
    const id = (await ctx.params).id;
    return response(
      body.action === "QUOTE"
        ? await quoteEnvia(token, id, body.data)
        : body.action === "GENERATE"
          ? await generateEnvia(token, id, body.data)
          : await trackEnvia(token, id),
    );
  } catch (e) {
    return failure(e);
  }
}
