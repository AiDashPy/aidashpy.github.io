const ALLOWED_ORIGINS = [
  "https://aidashpy.com",
  "https://aidashpy.github.io",
];

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try { return new URL(origin).hostname === "localhost"; } catch { return false; }
}

function corsHeaders(origin) {
  const allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
    Vary: "Origin",
  };
}

// Images are public assets — wildcard CORS so cached responses work for all origins
const IMAGE_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function isAuthed(req, env) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return token.length > 0 && token === env.ADMIN_TOKEN;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") ?? "";
    const h = corsHeaders(origin);
    const { pathname } = url;

    if (req.method === "OPTIONS") {
      const isImg = pathname.startsWith("/images/");
      return new Response(null, { status: 204, headers: isImg ? IMAGE_CORS : h });
    }

    // ── Health / auth ────────────────────────────────────────
    if (pathname === "/ping") return new Response("ok", { headers: h });

    if (pathname === "/auth") {
      if (!isAuthed(req, env)) return new Response("Unauthorized", { status: 401, headers: h });
      return new Response("ok", { headers: h });
    }

    // ── layout mode ─────────────────────────────────────────
    if (pathname === "/layout") {
      if (req.method === "GET") {
        const mode = await env.KV.get("layout");
        return new Response(JSON.stringify({ mode: mode ?? "poster" }), {
          headers: { ...h, "Content-Type": "application/json", "Cache-Control": "no-cache" },
        });
      }
      if (req.method === "PUT") {
        let body;
        try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: h }); }
        if (!body.pin || body.pin !== env.LAYOUT_PIN) return new Response("Unauthorized", { status: 401, headers: h });
        const mode = body.mode;
        if (!["poster", "constructivist"].includes(mode)) return new Response("Bad request", { status: 400, headers: h });
        await env.KV.put("layout", mode);
        return new Response("ok", { headers: h });
      }
    }

    // ── books.json ───────────────────────────────────────────
    if (pathname === "/books.json") {
      if (req.method === "GET") {
        // cacheTtl caches the KV value at Cloudflare's edge for 60s — reduces KV read ops
        const { value: data, metadata } = await env.KV.getWithMetadata("books", {
          type: "text",
          cacheTtl: 60,
        });
        const etag = `"${metadata?.etag ?? "init"}"`;

        // Return 304 if client already has the current version
        if (req.headers.get("If-None-Match") === etag) {
          return new Response(null, { status: 304, headers: { ...h, ETag: etag } });
        }

        return new Response(data ?? "[]", {
          headers: {
            ...h,
            "Content-Type": "application/json",
            // No browser caching — admin changes must be instant for the author
            // CDN/KV edge cache handles the server-side savings instead
            "Cache-Control": "no-cache",
            ETag: etag,
          },
        });
      }

      if (req.method === "PUT") {
        if (!isAuthed(req, env)) return new Response("Unauthorized", { status: 401, headers: h });
        const body = await req.text();
        try { JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400, headers: h }); }
        // Store a short timestamp-based etag in metadata so readers can detect changes
        await env.KV.put("books", body, { metadata: { etag: Date.now().toString(36) } });
        return new Response("ok", { headers: h });
      }
    }

    // ── images ───────────────────────────────────────────────
    if (pathname.startsWith("/images/")) {
      const key = decodeURIComponent(pathname.slice(8));
      if (!key) return new Response("Not found", { status: 404, headers: IMAGE_CORS });

      if (req.method === "GET") {
        // Check Cloudflare edge cache first — hits here cost 0 R2 ops and 0 Worker CPU
        const cache = caches.default;
        const cached = await cache.match(req);
        if (cached) return cached;

        const obj = await env.R2.get(key);
        if (!obj) return new Response("Not found", { status: 404, headers: IMAGE_CORS });

        const response = new Response(obj.body, {
          headers: {
            ...IMAGE_CORS,
            "Content-Type": obj.httpMetadata?.contentType ?? "image/webp",
            // Immutable: browsers and CDN cache forever — images never change in place
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
        // Cache at this edge PoP — future requests from nearby users skip R2 entirely
        await cache.put(req, response.clone());
        return response;
      }

      if (req.method === "PUT") {
        if (!isAuthed(req, env)) return new Response("Unauthorized", { status: 401, headers: IMAGE_CORS });
        const ct = req.headers.get("Content-Type") ?? "image/webp";
        await env.R2.put(key, req.body, { httpMetadata: { contentType: ct } });
        return new Response("ok", { headers: IMAGE_CORS });
      }
    }

    return new Response("Not found", { status: 404, headers: h });
  },
};
