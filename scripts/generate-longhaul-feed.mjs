import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "longhaul-feed.xml";
const BASE = "https://longhaulmag.com";
const SELF = "https://aidashpy.com/longhaul-feed.xml";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; FeedBot/1.0)",
  "Accept": "text/html,*/*",
};

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—");

// ── Scrape both listing pages for article URLs ────────────────
async function scrapeArticleUrls(pageUrl) {
  const res = await fetch(pageUrl, { headers: HEADERS });
  if (!res.ok) throw new Error(`${pageUrl} returned HTTP ${res.status}`);
  const html = await res.text();
  const urls = new Set();
  const navSlugs = new Set([
    "about", "archive", "store", "subscribe", "dispatches", "materials",
    "materials-online-only", "materials-all-articles", "feed", "comments",
    "wp-json",
  ]);
  for (const m of html.matchAll(/href="(https:\/\/longhaulmag\.com\/([^"/?#]+)\/?)"/g)) {
    const slug = m[2].replace(/\/$/, "");
    if (!slug || navSlugs.has(slug) || slug.startsWith("wp-") || slug.startsWith("2026")) continue;
    urls.add(m[1].replace(/\/$/, ""));
  }
  return urls;
}

const [onlineOnly, allArticles] = await Promise.all([
  scrapeArticleUrls(`${BASE}/materials-online-only/`),
  scrapeArticleUrls(`${BASE}/materials-all-articles/`),
]);

const allUrls = new Set([...onlineOnly, ...allArticles]);
const slugs = [...allUrls].map((u) => u.replace(`${BASE}/`, "").replace(/\/$/, ""));

if (slugs.length === 0)
  throw new Error("No article slugs found — page structure may have changed");

console.log(`Found ${onlineOnly.size} online-only + ${allArticles.size} all-articles = ${slugs.length} unique articles`);

// ── Fetch pages + posts from WP REST API in parallel ─────────
const API_FIELDS = "id,slug,title,link,date,excerpt";
const [pagesRes, postsRes] = await Promise.all([
  fetch(`${BASE}/wp-json/wp/v2/pages?per_page=100&_fields=${API_FIELDS}`, { headers: { "User-Agent": HEADERS["User-Agent"] } }),
  fetch(`${BASE}/wp-json/wp/v2/posts?per_page=100&_fields=${API_FIELDS}`, { headers: { "User-Agent": HEADERS["User-Agent"] } }),
]);
if (!pagesRes.ok) throw new Error(`WP pages API returned HTTP ${pagesRes.status}`);
if (!postsRes.ok) throw new Error(`WP posts API returned HTTP ${postsRes.status}`);

const allPages = await pagesRes.json();
const allPosts = await postsRes.json();

// Index pages by slug for O(1) lookup
const bySlug = new Map(allPages.map((p) => [p.slug, p]));

const toItem = (p) => ({
  url: p.link.replace(/\/$/, ""),
  title: decode(strip(p.title.rendered)),
  excerpt: decode(strip(p.excerpt?.rendered ?? "")).slice(0, 300),
  pubDate: new Date(p.date).toUTCString(),
});

// Materials: resolve scraped slugs against pages index
const items = [];
for (const slug of slugs) {
  const page = bySlug.get(slug);
  if (!page) { console.warn(`  no API data for slug: ${slug}`); continue; }
  items.push(toItem(page));
}

// Dispatches: all WP Posts (higher-ed + k-12) — their full post set matches exactly
for (const post of allPosts) {
  items.push(toItem(post));
}

// Deduplicate by URL, sort newest first
const seen = new Set();
const deduped = items.filter((i) => { if (seen.has(i.url)) return false; seen.add(i.url); return true; });
deduped.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

if (deduped.length === 0)
  throw new Error("No items resolved from WP API — check slug matching");

console.log(`${items.length - deduped.length} duplicates removed; ${deduped.length} total items`);

// ── Build RSS ─────────────────────────────────────────────────
const itemsXml = deduped
  .map(({ url, title, pubDate, excerpt }) =>
    `  <item>
    <title>${esc(title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    <pubDate>${pubDate}</pubDate>${excerpt ? `\n    <description>${esc(excerpt)}</description>` : ""}
  </item>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Long-Haul Mag</title>
    <link>${BASE}</link>
    <description>Materials and Dispatches articles from Long-Haul Mag</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SELF}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${deduped.length} items → ${OUT}`);
