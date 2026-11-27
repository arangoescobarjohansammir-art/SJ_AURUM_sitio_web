import { getDb } from "@/lib/db";
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const asset = await getDb().mediaAsset.findUnique({
    where: { id },
    select: { data: true },
  });
  if (!asset) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
