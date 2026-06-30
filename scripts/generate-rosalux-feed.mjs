import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "rosalux-feed.xml";

// Rosa Luxemburg Foundation — English news (also includes publications)
const SOURCE = "https://www.rosalux.de/en/rss.xml";

const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; FeedBot/1.0)" };

const res = await fetch(SOURCE, {
  headers: { ...HEADERS, Accept: "application/rss+xml, application/xml, text/xml, */*" },
});
if (!res.ok) throw new Error(`rosalux RSS returned HTTP ${res.status}`);
const xmlText = await res.text();

// Unwrap CDATA or plain text from a tag
const tagVal = (body, tag) => {
  const m =
    body.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i")) ??
    body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
};

const decode = (s) =>
  s
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

const ogImage = async (url) => {
  try {
    const r = await fetch(url, { headers: HEADERS });
    if (!r.ok) return null;
    const html = await r.text();
    return (
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)?.[1] ??
      null
    );
  } catch {
    return null;
  }
};

const items = [];
for (const m of xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
  const body = m[1];
  const link = tagVal(body, "link");
  items.push({
    title: decode(tagVal(body, "title")),
    link,
    pubDate: tagVal(body, "pubDate"),
    description: strip(decode(tagVal(body, "description"))),
  });
}

if (items.length === 0)
  throw new Error("No items parsed from rosalux feed — check the feed URL or response format");

// Fetch og:image for each article (sequentially to be polite)
for (const item of items) {
  item.image = await ogImage(item.link);
}

const itemsXml = items
  .map(
    ({ title, link, pubDate, description, image }) =>
      `  <item>
    <title>${esc(title)}</title>
    <link>${esc(link)}</link>
    <guid isPermaLink="true">${esc(link)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${esc(description)}</description>${image ? `\n    <media:content url="${esc(image)}" medium="image"/>` : ""}
  </item>`
  )
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Rosa Luxemburg Foundation – English</title>
    <link>https://www.rosalux.de/en/</link>
    <description>Latest news and publications from the Rosa Luxemburg Foundation (English)</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/rosalux-feed.xml" rel="self" type="application/rss+xml"/>
${itemsXml}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${items.length} items → ${OUT}`);
