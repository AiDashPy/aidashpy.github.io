// Generates RSS for lareviewofbooks.org.
// The site blocks plain curl/wget but passes Node.js fetch with standard
// browser Sec-Fetch headers. Fetches page 1 of reviews, essays, and
// interviews listings, combines, deduplicates, and sorts newest-first.
//
// The listing pages are Next.js App Router pages rendered server-side as
// plain HTML (no __NEXT_DATA__ blob — that was the old Pages Router), so
// article cards are scraped directly out of the markup. Dates on the
// listing only show "Mon D" with no year, so the current year is assumed
// unless that would put the date in the future, in which case it's assumed
// to be last year's.

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

const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();

const decodeEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

function parseListingDate(text) {
  const now = new Date();
  let d = new Date(`${text} ${now.getUTCFullYear()} UTC`);
  if (isNaN(d.getTime())) return null;
  if (d.getTime() > now.getTime() + 2 * 24 * 60 * 60 * 1000) {
    d = new Date(`${text} ${now.getUTCFullYear() - 1} UTC`);
  }
  return d;
}

async function fetchTypeArticles(type) {
  const url = `${BASE}/articles/${type}/all`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();

  const entryRe = /<article class="[^"]*Px-I7a__container[^"]*"/g;
  const positions = [];
  let m;
  while ((m = entryRe.exec(html)) !== null) positions.push(m.index);
  if (positions.length === 0) throw new Error(`No article cards found on ${type} listing — page structure may have changed`);
  positions.push(html.length);

  const docs = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const block = html.slice(positions[i], positions[i + 1]);

    const hrefM = block.match(/href="(\/article\/[^"/]+)\/?"/);
    if (!hrefM) continue;
    const slug = hrefM[1].replace(/^\/article\//, "");

    const titleM = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/);
    const title = titleM ? decodeEntities(stripTags(titleM[1])) : "";
    if (!title) continue;

    const dekM = block.match(/__dek[^"]*">([\s\S]*?)<\/p>/);
    const description = dekM ? decodeEntities(stripTags(dekM[1])) : "";

    const dateM = block.match(/Px-I7a__date"[^>]*>([^<]+)/);
    const date = dateM ? parseListingDate(dateM[1].trim()) : null;
    if (!date) continue;

    const imgM = block.match(/\ssrc="(https:\/\/cdn\.lareviewofbooks\.org[^"]+)"/);

    docs.push({
      url: `${BASE}/article/${slug}/`,
      title,
      description,
      pubDate: date.toUTCString(),
      pubMs: date.getTime(),
      img: imgM ? imgM[1] : null,
    });
  }

  console.log(`  [${type}] ${docs.length} articles`);
  return docs;
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
