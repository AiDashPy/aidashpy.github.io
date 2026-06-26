import { writeFileSync } from "fs";

const OUT = process.argv[2] ?? "nacla-feed.xml";

const apiUrl =
  "https://nacla.org/wp-json/wp/v2/posts" +
  "?categories=11598,9303" +
  "&categories_exclude=11606,11716" +
  "&per_page=50&orderby=date&order=desc" +
  "&_fields=id,title,link,date,excerpt,yoast_head_json";

const res = await fetch(apiUrl, { headers: { Accept: "application/json" } });
if (!res.ok) throw new Error(`API returned ${res.status}`);
const posts = await res.json();

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s) => s.replace(/<[^>]+>/g, "").trim();

const items = posts
  .map((p) => {
    const pub = new Date(p.date + "Z").toUTCString();
    const imgUrl = p.yoast_head_json?.og_image?.[0]?.url;
    const mediaTag = imgUrl
      ? `\n    <media:content url="${esc(imgUrl)}" medium="image"/>`
      : "";
    return `  <item>
    <title>${esc(strip(p.title.rendered))}</title>
    <link>${esc(p.link)}</link>
    <guid isPermaLink="true">${esc(p.link)}</guid>
    <pubDate>${pub}</pubDate>
    <description>${esc(strip(p.excerpt.rendered))}</description>${mediaTag}
  </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>NACLA – News &amp; Analysis + Reviews (English)</title>
    <link>https://nacla.org/web/</link>
    <description>English-language articles and reviews from NACLA</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/nacla-feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`Wrote ${posts.length} items → ${OUT}`);
