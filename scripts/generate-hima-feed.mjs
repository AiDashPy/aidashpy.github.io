import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "hima-feed.xml";
const SOURCE = "https://brill.com/view/journals/hima/hima-overview.xml";
const BASE = "https://brill.com";
const LIMIT = 15;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

const res = await fetch(SOURCE, { headers: HEADERS });
if (!res.ok) throw new Error(`Brill HIMA page returned HTTP ${res.status}`);
const html = await res.text();

// Find the Latest Articles section so we don't accidentally grab archive entries
const latestStart = html.indexOf("component-latest-articles");
if (latestStart === -1) throw new Error("Could not find Latest Articles section — page structure may have changed");
const section = html.slice(latestStart);

// Split by article entry boundaries
const entryRe = /<div[^>]+data-testid="layout-list-entry[^"]*"[^>]*>/g;
let m;
const positions = [];
while ((m = entryRe.exec(section)) !== null) positions.push(m.index);

if (positions.length === 0)
  throw new Error("No article entries found in Latest Articles section — page structure may have changed");

positions.push(section.length);

const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const items = [];
for (let i = 0; i < Math.min(positions.length - 1, LIMIT); i++) {
  const block = section.slice(positions[i], positions[i + 1]);

  const hrefM = block.match(/href="(\/view\/journals\/hima\/[^"]+\.xml)"/);
  if (!hrefM) continue;
  const url = BASE + hrefM[1];

  // Title may contain <i> or other inline tags — strip them
  const titleM = block.match(/class="c-Button--link">([\s\S]*?)<\/a>/);
  const title = titleM ? strip(titleM[1]) : "";
  if (!title) continue;

  const openAccess = /aria-label="Open Access"/.test(block);

  const authors = [...block.matchAll(/data-testid="author-name"[^>]*>([^<]+)<\/span>/g)]
    .map((x) => x[1].trim());

  // Date format from page: "10 Jun 2026"
  const dateM = block.match(/onlinepubdate[\s\S]*?<dd[^>]*>[\s\S]*?(\d{1,2}\s+\w{3}\s+\d{4})/);
  const pubDate = dateM ? new Date(dateM[1]).toUTCString() : "";

  items.push({ url, title, openAccess, authors, pubDate });
}

if (items.length === 0)
  throw new Error("No articles could be parsed — check extraction logic");

const itemsXml = items
  .map(({ url, title, openAccess, authors, pubDate }) => {
    const displayTitle = openAccess ? `[OA] ${title}` : title;
    const authorLine = authors.length ? `\n    <author>${esc(authors.join(", "))}</author>` : "";
    const dateEl = pubDate ? `\n    <pubDate>${pubDate}</pubDate>` : "";
    const desc = [
      openAccess ? "Open Access" : "Restricted Access",
      authors.length ? `Author(s): ${authors.join(", ")}` : "",
    ].filter(Boolean).join(" · ");
    return `  <item>
    <title>${esc(displayTitle)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>${dateEl}
    <description>${esc(desc)}</description>${authorLine}
  </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Historical Materialism (Brill)</title>
    <link>${SOURCE}</link>
    <description>Latest advance articles from Historical Materialism journal</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/hima-feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
console.log(items.map((x) => `  [${x.openAccess ? "OA" : "  "}] ${x.title.slice(0, 70)}`).join("\n"));
