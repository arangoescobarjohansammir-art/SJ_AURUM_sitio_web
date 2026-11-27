import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const path = "/api/payments/wompi/events";
export function createWebhookRelay(upstream = "http://127.0.0.1:3000") {
  const target = new URL(upstream);
  if (target.origin !== "http://127.0.0.1:3000")
    throw Error("El receptor solo puede apuntar a la tienda local:3000");
  let active = 0,
    count = 0,
    windowStart = Date.now();
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const end = (status: number) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status }));
    };
    if (req.url !== path || req.method !== "POST") {
      req.resume();
      end(404);
      return;
    }
    if (
      req.headers["content-type"]?.split(";")[0].trim() !== "application/json"
    ) {
      req.resume();
      end(415);
      return;
    }
    if (Date.now() - windowStart > 60000) {
      windowStart = Date.now();
      count = 0;
    }
    if (++count > 120 || active >= 8) {
      req.resume();
      end(429);
      return;
    }
    if (Number(req.headers["content-length"] ?? 0) > 16384) {
      req.resume();
      end(413);
      return;
    }
    active++;
    try {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16384) {
          end(413);
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks).toString("utf8");
      try {
        JSON.parse(body);
      } catch {
        end(400);
        return;
      }
      const result = await fetch(new URL(path, target), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      // No response payload or request headers/cookies from the app are exposed.
      end(result.status);
      console.log(`Evento Wompi: HTTP ${result.status}`);
    } catch {
      if (!res.headersSent) end(503);
    } finally {
      active--;
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxConnections = 32;
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createWebhookRelay();
  server.listen(3001, "127.0.0.1", () =>
    console.log("Receptor restringido en 127.0.0.1:3001; solo POST " + path),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => server.close());
}
