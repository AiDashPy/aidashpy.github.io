// Generates RSS for lareviewofbooks.org.
// The site blocks plain curl/wget but passes Node.js fetch with standard
// browser Sec-Fetch headers. Fetches page 1 of reviews, essays, and
// interviews listings, combines, deduplicates, and sorts newest-first.

import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "lrob-feed.xml";
const BASE = "https://lareviewofbooks.org";
const SELF = "https://aidashpy.com/lrob-feed.xml";
const MAX_ITEMS = 50;
const TYPES = ["reviews", "essays", "interviews"];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

async function fetchTypeArticles(type) {
  const url = `${BASE}/articles/${type}/all`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`No __NEXT_DATA__ on ${type} listing`);
  const docs = JSON.parse(m[1]).props?.pageProps?.articles?.docs ?? [];
  console.log(`  [${type}] ${docs.length} articles`);
  return docs.map((d) => ({
    url: `${BASE}/article/${d.slug}/`,
    title: d.title ?? d.slug,
    description: d.description ?? "",
    pubDate: new Date(d.publish_date).toUTCString(),
    pubMs: new Date(d.publish_date).getTime(),
    img: d.featured_image?.url ?? null,
  }));
}

console.log("Fetching article listings...");
const raw = (await Promise.all(TYPES.map(fetchTypeArticles))).flat();

const seen = new Set();
const items = raw
  .filter((i) => { if (seen.has(i.url)) return false; seen.add(i.url); return true; })
  .sort((a, b) => b.pubMs - a.pubMs)
  .slice(0, MAX_ITEMS);

if (items.length === 0) throw new Error("No articles found");
console.log(`${raw.length} raw → ${items.length} after dedup/sort`);

const itemsXml = items
  .map(({ url, title, description, pubDate, img }) => {
    const media = img ? `\n    <media:content url="${esc(img)}" medium="image"/>` : "";
    return `  <item>
    <title>${esc(title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    <pubDate>${pubDate}</pubDate>${description ? `\n    <description>${esc(description)}</description>` : ""}${media}
  </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Los Angeles Review of Books</title>
    <link>${BASE}</link>
    <description>Reviews, essays, and interviews from the Los Angeles Review of Books</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SELF}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
