import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "sso-feed.xml";

// Sage RSS 1.0 feed for Science & Society (URL slug: sso, Sage journal code: SSO)
const SAGE_FEED =
  "https://journals.sagepub.com/action/showFeed" +
  "?ui-pref-journal-rss-frequency=article&type=etoc&feed=rss&jc=SSO";

const res = await fetch(SAGE_FEED, {
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; FeedBot/1.0)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});
if (!res.ok) throw new Error(`Sage RSS returned HTTP ${res.status}`);
const xmlText = await res.text();

const tagVal = (body, tag) => {
  const m = body.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
};

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

// RSS 1.0 items are <item rdf:about="URL">…</item> at the document root
const items = [];
for (const m of xmlText.matchAll(/<item rdf:about="([^"]*)">([\s\S]*?)<\/item>/g)) {
  const url = m[1].replace(/\?af=R$/, "");
  const body = m[2];
  const dcDate = tagVal(body, "dc:date");
  items.push({
    url,
    title: decode(tagVal(body, "title")),
    description: strip(decode(tagVal(body, "description"))),
    pubDate: dcDate ? new Date(dcDate).toUTCString() : new Date().toUTCString(),
    author: decode(tagVal(body, "dc:creator")),
  });
}

if (items.length === 0)
  throw new Error("No items parsed from Sage feed — check the feed URL or response format");

const itemsXml = items
  .map(
    ({ url, title, description, pubDate, author }) =>
      `  <item>
    <title>${esc(title)}</title>
    <link>${esc(url)}</link>
    <guid isPermaLink="true">${esc(url)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${esc(description)}</description>${author ? `\n    <author>${esc(author)}</author>` : ""}
  </item>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Science &amp; Society</title>
    <link>https://journals.sagepub.com/home/sso</link>
    <description>Most recent articles from Science &amp; Society (Sage Journals)</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/sso-feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
