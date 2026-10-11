// Generates a combined RSS feed for all articles on troploin.fr.
//
// The site (Drupal 7) spreads its articles across several paginated
// listings — /textes (6 pages), /la-banquise, /lire-aussi — with no single
// "all articles" view and no publication date shown anywhere on the
// rendered pages themselves. Drupal does track a real creation date
// internally, and exposes it (as <pubDate>) through /rss.xml and through
// each taxonomy term's /taxonomy/term/<tid>/feed — but both are hard-capped
// at 10 items, so they only cover the most recently added articles, not the
// backlog. (The date shown on /search/node/... results is the *last edited*
// timestamp, not publication — it's identical across dozens of unrelated
// articles from one bulk content migration and must not be used as pubDate.)
//
// Strategy: for each article already known from a previous run (read back
// from the existing output file, same trick generate-endnotes-feed.mjs
// uses), keep its previously-resolved pubDate/description so the feed
// stays stable. For a newly-discovered article, try — in order — the
// site's own /rss.xml, then its taxonomy terms' feeds, then the Wayback
// Machine's first-capture date for that URL as a rough approximation, and
// only fall back to "today" if nothing else is found. This keeps routine
// runs cheap (a handful of listing fetches, no new articles most of the
// time) while giving the one-time backfill of the existing ~75 articles a
// real chronological spread instead of bunching them all at today's date.

import { writeFileSync, readFileSync } from "fs";

const OUT = process.argv[2] ?? "troploin-feed.xml";
const BASE = "https://troploin.fr";
const SELF = "https://aidashpy.com/troploin-feed.xml";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; FeedBot/1.0)",
  "Accept": "text/html,*/*",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const decodeEntities = (s) =>
  String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"');

const strip = (s) => decodeEntities(String(s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function getText(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// ── Load existing feed for date + description persistence ─────
const knownMeta = new Map(); // url -> { pubDate, description }
try {
  const old = readFileSync(OUT, "utf-8");
  for (const m of old.matchAll(
    /<guid[^>]*>([^<]+)<\/guid>\s*<pubDate>([^<]+)<\/pubDate>(?:\s*<description>([\s\S]*?)<\/description>)?/g
  )) {
    knownMeta.set(m[1].trim(), { pubDate: m[2].trim(), description: decodeEntities(m[3]?.trim() ?? "") });
  }
  console.log(`Loaded ${knownMeta.size} known entries from existing feed`);
} catch {
  // First run — file doesn't exist yet
}

// ── Scrape the three listings ──────────────────────────────────
function parseListing(html) {
  const positions = [...html.matchAll(/<li class="views-row/g)].map((m) => m.index);
  positions.push(html.length);
  const out = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const block = html.slice(positions[i], positions[i + 1]);
    const hrefM = block.match(/href="\/node\/(\d+)"/);
    if (!hrefM) continue;
    const nid = hrefM[1];
    const url = `${BASE}/node/${nid}`;

    const titleM = block.match(/views-field-field-titre-court[\s\S]*?<h2>([\s\S]*?)<\/h2>/);
    const title = titleM ? strip(titleM[1]) : "";
    if (!title) continue;

    const bodyM = block.match(/views-field-body[\s\S]*?field-content">([\s\S]*?)<\/div>\s*<\/div>/);
    const description = bodyM ? strip(bodyM[1]) : "";

    const imgM = block.match(/<img[^>]+src="([^"]+)"/);
    const image = imgM ? imgM[1] : null;

    out.push({ nid, url, title, description, image });
  }
  return out;
}

console.log("Fetching listings...");
const listingPages = [
  `${BASE}/textes?page=0`,
  `${BASE}/textes?page=1`,
  `${BASE}/textes?page=2`,
  `${BASE}/textes?page=3`,
  `${BASE}/textes?page=4`,
  `${BASE}/textes?page=5`,
  `${BASE}/la-banquise`,
  `${BASE}/lire-aussi`,
];

const byNid = new Map();
for (const url of listingPages) {
  const html = await getText(url);
  const rows = parseListing(html);
  console.log(`  ${url}: ${rows.length} rows`);
  for (const row of rows) byNid.set(row.nid, row);
  await sleep(200);
}

if (byNid.size === 0) throw new Error("No articles found on any listing — page structure may have changed");
console.log(`${byNid.size} unique articles across all listings`);

// ── Date resolution for newly-discovered articles only ─────────
const newNids = [...byNid.keys()].filter((nid) => !knownMeta.has(`${BASE}/node/${nid}`));
console.log(`${newNids.length} new article(s) need a date`);

const dateMap = new Map(); // node url -> Date

function harvestFeedDates(xml) {
  for (const m of xml.matchAll(
    /<item>\s*<title>[\s\S]*?<\/title>\s*<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>/g
  )) {
    const url = m[1].trim().replace(/\?.*$/, "");
    if (!dateMap.has(url)) dateMap.set(url, new Date(m[2].trim()));
  }
}

if (newNids.length > 0) {
  // 1) sitewide recent-content feed (real Drupal "created" dates, latest 10)
  try {
    harvestFeedDates(await getText(`${BASE}/rss.xml`));
  } catch (e) {
    console.log(`  rss.xml failed: ${e.message}`);
  }

  // 2) per-taxonomy-term feeds for each new article's own terms (also real
  //    "created" dates, latest 10 per term — a term with a short backlog
  //    will surface a genuinely old article's real date)
  const triedTerms = new Set();
  for (const nid of newNids) {
    const url = `${BASE}/node/${nid}`;
    if (dateMap.has(url)) continue;
    let html;
    try {
      html = await getText(url);
    } catch (e) {
      console.log(`  node/${nid} fetch failed: ${e.message}`);
      continue;
    }
    await sleep(150);
    const terms = [...new Set([...html.matchAll(/taxonomy\/term\/(\d+)/g)].map((m) => m[1]))];
    for (const tid of terms) {
      if (dateMap.has(url)) break;
      if (triedTerms.has(tid)) continue;
      triedTerms.add(tid);
      try {
        harvestFeedDates(await getText(`${BASE}/taxonomy/term/${tid}/feed`));
      } catch {
        // ignore — just means this term's feed didn't help
      }
      await sleep(150);
    }
  }

  // 3) Wayback Machine first-capture date, as a rough approximation, for
  //    anything still undated
  for (const nid of newNids) {
    const url = `${BASE}/node/${nid}`;
    if (dateMap.has(url)) continue;
    try {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=troploin.fr/node/${nid}&matchType=exact&output=json&fl=timestamp&filter=statuscode:200&limit=1`;
      const cdx = JSON.parse(await getText(cdxUrl));
      if (cdx.length > 1) {
        const ts = cdx[1][0]; // YYYYMMDDHHMMSS
        const d = new Date(
          `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)}Z`
        );
        dateMap.set(url, d);
      }
    } catch {
      // ignore — falls through to "today" below
    }
    await sleep(150);
  }
}

// ── Assemble items ──────────────────────────────────────────────
const items = [];
for (const [nid, row] of byNid) {
  const url = row.url;
  const known = knownMeta.get(url);
  const pubDate = known?.pubDate ?? dateMap.get(url)?.toUTCString() ?? new Date().toUTCString();
  const description = known?.description ?? row.description ?? "";
  items.push({ url, title: row.title, description, image: row.image, pubDate, pubMs: new Date(pubDate).getTime() });
}

items.sort((a, b) => b.pubMs - a.pubMs);

// ── Build RSS ─────────────────────────────────────────────────
const itemsXml = items
  .map(({ url, title, description, image, pubDate }) => {
    const media = image ? `\n    <media:content url="${esc(image)}" medium="image"/>` : "";
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
    <title>troploin</title>
    <link>${BASE}</link>
    <description>All articles from troploin.fr (Textes, La Banquise, Lire aussi)</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SELF}" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
