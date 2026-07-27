// Generates RSS for lareviewofbooks.org via Wayback Machine snapshots.
// The site blocks automated requests; we use Wayback CDX to find the most
// recent real snapshot of each article-type listing, extract __NEXT_DATA__,
// combine reviews + essays + interviews, sort newest-first.

import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "lrob-feed.xml";
const BASE = "https://lareviewofbooks.org";
const SELF = "https://aidashpy.com/lrob-feed.xml";
const WB = "https://web.archive.org";
const MIN_BYTES = 10_000;
const MAX_ITEMS = 50;
const TYPES = ["reviews", "essays", "interviews"];

const UA = "Mozilla/5.0 (compatible; FeedBot/1.0)";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function fixMojibake(s) {
  if (!s) return s;
  // If all codepoints are in Latin-1 range, the string was likely UTF-8
  // bytes mis-decoded as Latin-1 — re-encode as bytes then decode as UTF-8.
  try {
    if ([...s].every((c) => c.charCodeAt(0) <= 255)) {
      return Buffer.from(s, "binary").toString("utf8");
    }
  } catch {}
  return s;
}

function stripWayback(url) {
  return url.replace(/^https?:\/\/web\.archive\.org\/web\/[^/]+(?:im_|cs_|js_)?\//, "");
}

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function bestSnapshotUrl(origUrl) {
  const cdx = `${WB}/cdx/search/cdx?url=${encodeURIComponent(origUrl)}&matchType=exact&output=json&fl=timestamp,length&sort=reverse&limit=20`;
  const rows = JSON.parse(await get(cdx)).slice(1);
  const good = rows.find((r) => parseInt(r[1], 10) >= MIN_BYTES);
  if (!good) return null;
  return `${WB}/web/${good[0]}/${origUrl}`;
}

async function fetchTypeArticles(type) {
  const listUrl = `${BASE}/articles/${type}/all`;
  const snapUrl = await bestSnapshotUrl(listUrl);
  if (!snapUrl) {
    console.warn(`  [${type}] no usable Wayback snapshot`);
    return [];
  }
  console.log(`  [${type}] ${snapUrl}`);
  const html = await get(snapUrl);
  const m = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) {
    console.warn(`  [${type}] no __NEXT_DATA__`);
    return [];
  }
  const docs = JSON.parse(m[1]).props?.pageProps?.articles?.docs ?? [];
  console.log(`  [${type}] ${docs.length} articles on page 1`);
  return docs.map((d) => {
    const imgRaw = d.featured_image?.url;
    const img = imgRaw ? stripWayback(imgRaw) : null;
    return {
      url: `${BASE}/article/${d.slug}/`,
      title: fixMojibake(d.title ?? d.slug),
      description: fixMojibake(d.description ?? ""),
      pubDate: new Date(d.publish_date).toUTCString(),
      pubMs: new Date(d.publish_date).getTime(),
      img: fixMojibake(img),
    };
  });
}

console.log("Fetching article listings from Wayback Machine...");
const raw = (await Promise.all(TYPES.map(fetchTypeArticles))).flat();

const seen = new Set();
const items = raw
  .filter((i) => { if (seen.has(i.url)) return false; seen.add(i.url); return true; })
  .sort((a, b) => b.pubMs - a.pubMs)
  .slice(0, MAX_ITEMS);

if (items.length === 0) throw new Error("No articles found — check Wayback snapshots");
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
