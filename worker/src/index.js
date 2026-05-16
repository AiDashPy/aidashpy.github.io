const ALLOWED_ORIGINS = [
  "https://aidashpy.com",
  "https://aidashpy.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8787",
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    Vary: "Origin",
  };
}

function isAuthed(req, env) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return token.length > 0 && token === env.ADMIN_TOKEN;
}

function json(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") ?? "";
    const h = corsHeaders(origin);
    const { pathname } = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    // ── Health / auth check ──────────────────────────────────
    if (pathname === "/ping") return new Response("ok", { headers: h });

    if (pathname === "/auth") {
      if (!isAuthed(req, env)) return new Response("Unauthorized", { status: 401, headers: h });
      return new Response("ok", { headers: h });
    }

    // ── books.json ───────────────────────────────────────────
    if (pathname === "/books.json") {
      if (req.method === "GET") {
        const data = await env.KV.get("books");
        return new Response(data ?? "[]", {
          headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }

      if (req.method === "PUT") {
        if (!isAuthed(req, env)) return new Response("Unauthorized", { status: 401, headers: h });
        const body = await req.text();
        try { JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400, headers: h }); }
        await env.KV.put("books", body);
        return new Response("ok", { headers: h });
      }
    }

    // ── images ───────────────────────────────────────────────
    if (pathname.startsWith("/images/")) {
      const key = pathname.slice(8);
      if (!key) return new Response("Not found", { status: 404, headers: h });

      if (req.method === "GET") {
        const obj = await env.R2.get(key);
        if (!obj) return new Response("Not found", { status: 404, headers: h });
        return new Response(obj.body, {
          headers: {
            ...h,
            "Content-Type": obj.httpMetadata?.contentType ?? "image/webp",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      if (req.method === "PUT") {
        if (!isAuthed(req, env)) return new Response("Unauthorized", { status: 401, headers: h });
        const ct = req.headers.get("Content-Type") ?? "image/webp";
        await env.R2.put(key, req.body, { httpMetadata: { contentType: ct } });
        return new Response("ok", { headers: h });
      }
    }

    return new Response("Not found", { status: 404, headers: h });
  },
};
