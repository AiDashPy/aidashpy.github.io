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

// ── Fetch all pages via WP REST API ──────────────────────────
// Pages API returns up to 100 per page; fetch all in one go since total is small
const apiRes = await fetch(
  `${BASE}/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,title,link,date,excerpt`,
  { headers: { "User-Agent": HEADERS["User-Agent"] } }
);
if (!apiRes.ok) throw new Error(`WP API returned HTTP ${apiRes.status}`);
const allPages = await apiRes.json();

// Index pages by slug for O(1) lookup
const bySlug = new Map(allPages.map((p) => [p.slug, p]));

const items = [];
for (const slug of slugs) {
  const page = bySlug.get(slug);
  if (!page) {
    console.warn(`  no API data for slug: ${slug}`);
    continue;
  }
  const title = decode(strip(page.title.rendered));
  const excerpt = decode(strip(page.excerpt?.rendered ?? "")).slice(0, 300);
  const pubDate = new Date(page.date).toUTCString();
  const url = page.link.replace(/\/$/, "");
  items.push({ url, title, pubDate, excerpt });
}

// Sort newest first
items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

if (items.length === 0)
  throw new Error("No items resolved from WP API — check slug matching");

// ── Build RSS ─────────────────────────────────────────────────
const itemsXml = items
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
    <title>Long-Haul Mag – Materials</title>
    <link>${BASE}/materials/</link>
    <description>Materials articles from Long-Haul Mag (online-only + all articles)</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SELF}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
