import { writeFileSync, readFileSync } from "fs";

const OUT = process.argv[2] ?? "endnotes-feed.xml";
const BASE = "https://www.endnotes.org.uk";
const SELF = "https://aidashpy.com/endnotes-feed.xml";
const LIMIT = 15;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; FeedBot/1.0)",
  "Accept": "text/html,*/*",
};

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

// ── Load existing feed for date + description persistence ─────
// New articles get freshly fetched metadata; previously seen articles
// keep their date and description so pubDates remain stable.
const knownMeta = new Map(); // url -> { pubDate, description }
try {
  const old = readFileSync(OUT, "utf-8");
  for (const m of old.matchAll(
    /<guid[^>]*>([^<]+)<\/guid>[\s\S]*?<pubDate>([^<]+)<\/pubDate>(?:[\s\S]*?<description>([^<]*)<\/description>)?/g
  )) {
    knownMeta.set(m[1].trim(), { pubDate: m[2].trim(), description: m[3]?.trim() ?? "" });
  }
  console.log(`Loaded ${knownMeta.size} known article entries from existing feed`);
} catch {
  // First run — file doesn't exist yet
}

// ── Scrape palabre listing ────────────────────────────────────
const listRes = await fetch(`${BASE}/palabre`, { headers: HEADERS });
if (!listRes.ok) throw new Error(`Endnotes palabre listing returned HTTP ${listRes.status}`);
const listHtml = await listRes.text();

const articles = [];
for (const m of listHtml.matchAll(
  /<a href="(https:\/\/www\.endnotes\.org\.uk\/palabre\/[^"]+)">\s*<div[^>]*>\s*([\s\S]*?)<\/div>\s*(?:<div[^>]*>\s*by ([\s\S]*?)<\/div>)?/g
)) {
  const url = m[1];
  const title = strip(m[2]);
  const author = m[3] ? strip(m[3]) : "";
  if (title && url && !url.includes("/page:")) {
    articles.push({ url, title, author });
  }
}

if (articles.length === 0)
  throw new Error("No articles parsed from palabre listing — page structure may have changed");

// ── Fetch metadata for each article ──────────────────────────
async function fetchMeta(url) {
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return {};
    const html = await r.text();

    // Unix timestamp embedded in media URL: /media/pages/palabre/<slug>/<hash>-<timestamp>/filename
    const tsM = html.match(/\/media\/pages\/palabre\/[^/]+\/[a-f0-9]+-(\d{9,10})\//);
    const pubDate = tsM ? new Date(Number(tsM[1]) * 1000).toUTCString() : null;

    // First non-empty <p> of article text as description (skip image-only paragraphs)
    const articleTextM = html.match(/<div[^>]*class="[^"]*article-text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    let description = "";
    if (articleTextM) {
      for (const pM of articleTextM[1].matchAll(/<p>([\s\S]*?)<\/p>/g)) {
        const text = strip(pM[1]);
        if (text.length > 40) { description = text.slice(0, 300); break; }
      }
    }

    return { pubDate, description };
  } catch {
    return {};
  }
}

const items = [];
for (const article of articles.slice(0, LIMIT)) {
  const known = knownMeta.get(article.url);
  let pubDate = known?.pubDate ?? null;
  let description = known?.description ?? "";

  if (!known) {
    console.log(`  fetching metadata for: ${article.title.slice(0, 60)}`);
    const meta = await fetchMeta(article.url);
    pubDate = meta.pubDate ?? new Date().toUTCString();
    description = meta.description ?? "";
  }

  items.push({ ...article, pubDate, description });
}

// ── Build RSS ─────────────────────────────────────────────────
const itemsXml = items
  .map(({ url, title, author, pubDate, description }) =>
    `  <item>
    <title>${esc(title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    <pubDate>${pubDate}</pubDate>${author ? `\n    <author>${esc(author)}</author>` : ""}${description ? `\n    <description>${esc(description)}</description>` : ""}
  </item>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Endnotes – Palabre</title>
    <link>${BASE}</link>
    <description>Recent articles from Endnotes (endnotes.org.uk)</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SELF}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
