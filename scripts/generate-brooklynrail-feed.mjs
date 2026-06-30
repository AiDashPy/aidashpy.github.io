import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "brooklynrail-feed.xml";
const SECTION_URL = "https://brooklynrail.org/section/field-notes/";
const BASE = "https://brooklynrail.org";
const LIMIT = 12;

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; FeedBot/1.0)" };

// Fetch section page and extract article URLs from embedded JSON
const pageRes = await fetch(SECTION_URL, { headers: HEADERS });
if (!pageRes.ok) throw new Error(`Section page returned HTTP ${pageRes.status}`);
const html = await pageRes.text();

const rawUrls = [
  ...new Set(
    [...html.matchAll(/brooklynrail\.org\/(\d{4}\/\d{2}\/field-notes\/[^\\\"'\s>]+)/g)].map(
      (m) => `${BASE}/${m[1]}`
    )
  ),
];

if (rawUrls.length === 0)
  throw new Error("No field-notes article URLs found in page — site structure may have changed");

// Sort descending by YYYY/MM from URL, take most recent
const sorted = rawUrls.sort((a, b) => {
  const date = (u) => u.match(/\/(\d{4}\/\d{2})\//)?.[1] ?? "";
  return date(b).localeCompare(date(a));
});
const articleUrls = sorted.slice(0, LIMIT);

// Fetch og metadata from each article page
const ogMeta = async (url) => {
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return null;
    const t = await r.text();
    const og = (prop) =>
      t.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`))?.[1] ??
      t.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`))?.[1] ??
      null;
    return {
      title: og("og:title")?.replace(/\s*\|\s*The Brooklyn Rail\s*$/, "").trim() ?? null,
      description: og("og:description") ?? null,
      image: og("og:image") ?? null,
      pubDate: og("article:published_time") ?? null,
    };
  } catch {
    return null;
  }
};

console.log(`Fetching metadata for ${articleUrls.length} articles…`);
const items = [];
for (const url of articleUrls) {
  const meta = await ogMeta(url);
  if (!meta?.title) { console.warn(`  skipped ${url}`); continue; }
  items.push({ url, ...meta });
  console.log(`  ✓ ${meta.title}`);
}

if (items.length === 0)
  throw new Error("No articles resolved — check the fetch logic");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const itemsXml = items
  .map(({ url, title, description, image, pubDate }) => {
    const date = pubDate ? new Date(pubDate).toUTCString() : "";
    return `  <item>
    <title>${esc(title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>${date ? `\n    <pubDate>${date}</pubDate>` : ""}${description ? `\n    <description>${esc(description)}</description>` : ""}${image ? `\n    <media:content url="${esc(image)}" medium="image"/>` : ""}
  </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Brooklyn Rail – Field Notes</title>
    <link>${SECTION_URL}</link>
    <description>Field Notes section from The Brooklyn Rail</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/brooklynrail-feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`\nWrote ${items.length} items → ${OUT}`);
