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
// New items get freshly fetched metadata; previously seen items
// keep their date and description so pubDates remain stable.
const knownMeta = new Map(); // url -> { pubDate, description }
try {
  const old = readFileSync(OUT, "utf-8");
  for (const m of old.matchAll(
    /<guid[^>]*>([^<]+)<\/guid>[\s\S]*?<pubDate>([^<]+)<\/pubDate>(?:[\s\S]*?<description>([^<]*)<\/description>)?/g
  )) {
    knownMeta.set(m[1].trim(), { pubDate: m[2].trim(), description: m[3]?.trim() ?? "" });
  }
  console.log(`Loaded ${knownMeta.size} known entries from existing feed`);
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
    articles.push({ url, title, author, kind: "palabre" });
  }
}

if (articles.length === 0)
  throw new Error("No articles parsed from palabre listing — page structure may have changed");

// ── Scrape dossiers listing ───────────────────────────────────
const dossierRes = await fetch(`${BASE}/dossiers`, { headers: HEADERS });
if (!dossierRes.ok) throw new Error(`Endnotes dossiers listing returned HTTP ${dossierRes.status}`);
const dossierHtml = await dossierRes.text();

// Extract id->timestamp from background image URLs before parsing list items
const bgTimestamps = new Map();
for (const m of dossierHtml.matchAll(
  /class="dossier-background[^"]*"[^>]*data-id="([^"]+)"[^>]*style="[^"]*\/[a-f0-9]+-(\d{9,10})\//g
)) {
  bgTimestamps.set(m[1], Number(m[2]));
}

const dossiers = [];
for (const m of dossierHtml.matchAll(
  /<li[^>]*data-id="([^"]+)"[^>]*>\s*<a href="(https:\/\/www\.endnotes\.org\.uk\/dossiers\/[^"]+)"[^>]*>\s*<div[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*>([\s\S]*?)<\/div>)?/g
)) {
  const id = m[1];
  const url = m[2];
  const title = strip(m[3]);
  const subtitle = strip(m[4] ?? "");
  if (!title) continue;
  const ts = bgTimestamps.get(id);
  const pubDate = ts ? new Date(ts * 1000).toUTCString() : null;
  dossiers.push({ url, title, subtitle, pubDate, kind: "dossier" });
}

if (dossiers.length === 0)
  throw new Error("No dossiers parsed from dossiers listing — page structure may have changed");

// ── Fetch metadata for new palabre articles ───────────────────
async function fetchPalabreMeta(url) {
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return {};
    const html = await r.text();

    // Unix timestamp embedded in media URL
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

// ── Resolve all items ─────────────────────────────────────────
const items = [];

for (const article of articles.slice(0, LIMIT)) {
  const known = knownMeta.get(article.url);
  let pubDate = known?.pubDate ?? null;
  let description = known?.description ?? "";

  if (!known) {
    console.log(`  fetching: ${article.title.slice(0, 60)}`);
    const meta = await fetchPalabreMeta(article.url);
    pubDate = meta.pubDate ?? new Date().toUTCString();
    description = meta.description ?? "";
  }

  items.push({ url: article.url, title: article.title, author: article.author, pubDate, description });
}

for (const dossier of dossiers) {
  const known = knownMeta.get(dossier.url);
  const pubDate = known?.pubDate ?? dossier.pubDate ?? new Date().toUTCString();
  // Description: subtitle text if present, otherwise nothing
  const description = known?.description ?? dossier.subtitle ?? "";
  items.push({ url: dossier.url, title: `Dossier: ${dossier.title}`, author: "", pubDate, description });
}

// Sort newest first
items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

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
    <title>Endnotes</title>
    <link>${BASE}</link>
    <description>Recent articles and dossiers from Endnotes (endnotes.org.uk)</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SELF}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items (${articles.length} palabre + ${dossiers.length} dossiers) → ${OUT}`);
