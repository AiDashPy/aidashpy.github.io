// Generates RSS for Historical Materialism journal articles.
//
// Brill's own site (brill.com) now fronts every request — including from
// GitHub Actions and plain fetch — with an AWS WAF CAPTCHA challenge, so
// scraping it is no longer possible without solving a CAPTCHA. Instead this
// pulls straight from CrossRef, the DOI registry publishers (including
// Brill) submit new articles to, keyed on the journal's ISSN. It's the
// official metadata source, not a scrape, so it won't break the way the
// HTML-scraping approach did.

import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "hima-feed.xml";
const ISSN = "1569-206x";
const SOURCE = `https://api.crossref.org/journals/${ISSN}/works?sort=created&order=desc&rows=20&select=DOI,title,author,abstract,published,published-online,published-print,created`;
const LIMIT = 15;

const HEADERS = {
  "User-Agent": "aidashpy-rss-bot/1.0 (+https://github.com/AiDashPy/aidashpy.github.io)",
};

const res = await fetch(SOURCE, { headers: HEADERS });
if (!res.ok) throw new Error(`CrossRef returned HTTP ${res.status}`);
const data = await res.json();
const works = data.message?.items ?? [];
if (works.length === 0) throw new Error("CrossRef returned no works for this journal");

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const stripJats = (s) => String(s ?? "").replace(/<[^>]+>/g, "").trim();

const dateFromParts = (parts) => {
  if (!parts) return null;
  const [y, m = 1, d = 1] = parts["date-parts"]?.[0] ?? [];
  if (!y) return null;
  return new Date(Date.UTC(y, m - 1, d));
};

const items = works
  .filter((w) => w.abstract) // drops front/back matter (notes on contributors, etc.)
  .map((w) => {
    const title = stripJats(w.title?.[0] ?? "");
    const authors = (w.author ?? [])
      .map((a) => [a.given, a.family].filter(Boolean).join(" "))
      .filter(Boolean);
    const date =
      dateFromParts(w["published-online"]) ??
      dateFromParts(w["published-print"]) ??
      dateFromParts(w.published) ??
      dateFromParts(w.created);
    const abstract = stripJats(w.abstract).replace(/^Abstract\s*/, "");
    return {
      url: `https://doi.org/${w.DOI}`,
      title,
      authors,
      pubDate: date ? date.toUTCString() : null,
      pubMs: date ? date.getTime() : 0,
      abstract,
    };
  })
  .filter((i) => i.title)
  .sort((a, b) => b.pubMs - a.pubMs)
  .slice(0, LIMIT);

if (items.length === 0) throw new Error("No articles could be parsed from CrossRef response");

const itemsXml = items
  .map(({ url, title, authors, pubDate, abstract }) => {
    const authorLine = authors.length ? `\n    <author>${esc(authors.join(", "))}</author>` : "";
    const dateEl = pubDate ? `\n    <pubDate>${pubDate}</pubDate>` : "";
    const desc = [
      authors.length ? `Author(s): ${authors.join(", ")}` : "",
      abstract,
    ].filter(Boolean).join(" — ");
    return `  <item>
    <title>${esc(title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>${dateEl}
    <description>${esc(desc)}</description>${authorLine}
  </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Historical Materialism</title>
    <link>https://brill.com/view/journals/hima/hima-overview.xml</link>
    <description>Latest articles from Historical Materialism journal, via CrossRef</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/hima-feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
console.log(items.map((x) => `  ${x.title.slice(0, 70)}`).join("\n"));
