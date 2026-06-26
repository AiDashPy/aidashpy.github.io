const OG_PAINTINGS = [
  "ThePaintingNewPlanetNew.webp",
  "udaltsova_ural_river.webp",
  "udaltsova_ural_forest_2.webp",
  "udaltsova_ural_sunset_2.webp",
  "udaltsova_ural_autumn.webp",
  "drevin_altai_dry_birch.webp",
  "drevin_gazelles.webp",
];

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

    // ── Random OG image (for Discord/social embeds) ──────────
    if (pathname === "/og-image") {
      const key = OG_PAINTINGS[Math.floor(Math.random() * OG_PAINTINGS.length)];
      return Response.redirect(`${url.origin}/images/${key}`, 302);
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

    // ── NACLA English feed ───────────────────────────────────
    if (pathname === "/nacla-feed.xml") {
      const xml = await env.KV.get("nacla-feed");
      if (!xml) return new Response("Feed not yet generated — check back in a minute.", { status: 503 });
      return new Response(xml, {
        headers: {
          "Content-Type": "application/rss+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: h });
  },

  async scheduled(_event, env) {
    await buildNaclaFeed(env);
  },
};

async function buildNaclaFeed(env) {
  const apiUrl = "https://nacla.org/wp-json/wp/v2/posts"
    + "?categories=11598,9303"
    + "&categories_exclude=11606,11716"
    + "&per_page=50&orderby=date&order=desc"
    + "&_fields=id,title,link,date,excerpt";

  const apiRes = await fetch(apiUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  const ct = apiRes.headers.get("content-type") ?? "";
  if (!apiRes.ok || !ct.includes("json")) throw new Error(`nacla API returned ${apiRes.status} ${ct}`);

  const posts = await apiRes.json();

  const escXml = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

  const items = posts.map((p) => {
    const title = escXml(stripTags(p.title.rendered));
    const link = escXml(p.link);
    const desc = escXml(stripTags(p.excerpt.rendered));
    const pub = new Date(p.date + "Z").toUTCString();
    return `  <item>
    <title>${title}</title>
    <link>${link}</link>
    <guid isPermaLink="true">${link}</guid>
    <pubDate>${pub}</pubDate>
    <description>${desc}</description>
  </item>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>NACLA – News &amp; Analysis + Reviews (English)</title>
    <link>https://nacla.org/web/</link>
    <description>English-language articles and reviews from NACLA</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy-api.adiashpy.workers.dev/nacla-feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  await env.KV.put("nacla-feed", xml, { expirationTtl: 7200 });
}
