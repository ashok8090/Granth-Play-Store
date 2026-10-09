import { mediaPath } from "./media";

const ORIGIN = "https://granth.wnmsolutions.com";
const ALLOWED = new Set(["getTopics", "getGranths", "getPramans"]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleCatalog(request: Request): Promise<Response> {
  const name = new URL(request.url).searchParams.get("request") ?? "";
  if (name === "bundle") {
    try {
      const names = ["getTopics", "getGranths", "getPramans"] as const;
      const bodies = await Promise.all(
        names.map(async (item) => {
          const upstream = await fetch(`${ORIGIN}/api/index.php?request=${item}`, {
            headers: { accept: "application/json" },
            signal: AbortSignal.timeout(40_000),
          });
          return (await upstream.json()) as { data?: unknown };
        }),
      );
      return json({
        success: true,
        data: { topics: bodies[0]?.data ?? [], granths: bodies[1]?.data ?? [], pramans: bodies[2]?.data ?? [] },
      });
    } catch {
      return json({ success: false, error: "upstream unavailable" }, 502);
    }
  }
  if (!ALLOWED.has(name)) return json({ success: false, error: "unknown request" }, 400);
  try {
    const upstream = await fetch(`${ORIGIN}/api/index.php?request=${name}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(40_000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return json({ success: false, error: "upstream unavailable" }, 502);
  }
}

export async function handleMedia(request: Request): Promise<Response> {
  const path = mediaPath(new URL(request.url).searchParams.get("src"));
  if (!path) return new Response("bad path", { status: 400 });
  try {
    const upstream = await fetch(`${ORIGIN}/${path}`, {
      signal: AbortSignal.timeout(25_000),
    });
    if (!upstream.ok) return new Response("not found", { status: upstream.status });
    const type = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!type.startsWith("image/")) return new Response("not an image", { status: 415 });
    const bytes = await upstream.arrayBuffer();
    return new Response(bytes, {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=604800",
      },
    });
  } catch {
    return new Response("unavailable", { status: 502 });
  }
}
