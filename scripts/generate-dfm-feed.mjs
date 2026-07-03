// Generates RSS for designformanufracture.com via Wayback Machine snapshots.
// The site blocks non-browser automated requests, so we use Wayback CDX + snapshots.
// CDX snapshots <20KB are JS challenge pages; we only use larger real-content captures.

import { writeFileSync } from "fs";

const SITE = "https://designformanufracture.com";
const OUT = process.argv[2] ?? "dfm-feed.xml";
const WB = "https://web.archive.org";
const MIN_CONTENT_BYTES = 20000;

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function stripWayback(url) {
  return url.replace(/^https?:\/\/web\.archive\.org\/web\/[^/]+(?:im_|cs_|js_)?\//, "");
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Get best Wayback snapshot URL: most recent capture that is real content (not a bot challenge)
async function bestSnapshot(origUrl) {
  const cdxText = await get(
    `${WB}/cdx/search/cdx?url=${encodeURIComponent(origUrl)}&output=json&fl=timestamp,length&sort=reverse&limit=10`
  );
  const rows = JSON.parse(cdxText).slice(1); // drop header
  const good = rows.find((r) => parseInt(r[1], 10) >= MIN_CONTENT_BYTES);
  if (!good) return null;
  return `${WB}/web/${good[0]}/${origUrl}`;
}

// Parse an article from its Wayback HTML
function parseHtml(html, origUrl) {
  const title = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const date = html.match(/<time[^>]*datetime="([^"]+)"/);
  // Featured image: src may appear before or after class in the tag
  const imgM =
    html.match(/src="([^"]+)"[^>]*class="[^"]*wp-post-image[^"]*"/) ||
    html.match(/class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/);
  const imgUrl = imgM ? stripWayback(imgM[1]) : null;

  let excerpt = null;
  const contentM = html.match(/class="entry-content[^"]*"[^>]*>(.*)/s);
  if (contentM) {
    for (const [, p] of [...contentM[1].matchAll(/<p[^>]*>(.*?)<\/p>/gs)]) {
      const clean = stripTags(p);
      if (clean.length > 80) { excerpt = clean.slice(0, 400); break; }
    }
  }

  return {
    url: origUrl,
    title: title ? stripTags(title[1]) : null,
    date: date ? date[1] : null,
    img: imgUrl,
    excerpt,
  };
}

// Extract article stubs from the homepage listing (for posts not yet individually archived)
function parseHomepageListing(html) {
  const stubs = [];
  // Each post on the homepage has a link with the dated URL + a heading nearby
  const postLinks = [...html.matchAll(/href="(https?:\/\/web\.archive\.org\/web\/[^/]+\/https:\/\/designformanufracture\.com\/(20\d\d)\/(\d\d)\/(\d\d)\/([^/"]+)\/)"[^>]*>(.*?)<\/a>/gs)];
  const seen = new Set();
  for (const [, href, yr, mo, dy, slug] of postLinks) {
    const origUrl = `https://designformanufracture.com/${yr}/${mo}/${dy}/${slug}/`;
    if (seen.has(origUrl)) continue;
    seen.add(origUrl);
    // Date from URL path
    const date = `${yr}-${mo}-${dy}T00:00:00Z`;
    // Title: slug → human readable (fallback; real title fetched later if possible)
    const titleFromSlug = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    stubs.push({ url: origUrl, date, titleFromSlug, waybackHref: href });
  }
  return stubs;
}

// ── Main ─────────────────────────────────────────────────────────────────────

// 1. Get latest Wayback homepage
const cdxHome = await get(
  `${WB}/cdx/search/cdx?url=${encodeURIComponent(SITE + "/")}&output=json&fl=timestamp,length&sort=reverse&limit=10`
);
const homeRows = JSON.parse(cdxHome).slice(1).find((r) => parseInt(r[1], 10) >= MIN_CONTENT_BYTES);
if (!homeRows) throw new Error("No good homepage snapshot found");
const homeSnapUrl = `${WB}/web/${homeRows[0]}/${SITE}/`;
console.log("Homepage snapshot:", homeSnapUrl);

const homeHtml = await get(homeSnapUrl);
const stubs = parseHomepageListing(homeHtml);
console.log(`Found ${stubs.length} posts on homepage`);

// 2. For each post, try to get full content from CDX; fall back to homepage stub
const articles = [];
for (const stub of stubs) {
  try {
    const snapUrl = await bestSnapshot(stub.url);
    if (snapUrl) {
      const html = await get(snapUrl);
      const art = parseHtml(html, stub.url);
      if (art.title && art.date) {
        articles.push(art);
        console.log("✓", art.title);
        continue;
      }
    }
    // Fall back: use stub data from homepage listing
    // Try to get title from the homepage HTML near the link
    const titleM = homeHtml.match(
      new RegExp(`href="${stub.waybackHref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>\\s*([^<]{5,200})`)
    );
    articles.push({
      url: stub.url,
      title: titleM ? stripTags(titleM[1]).trim() : stub.titleFromSlug,
      date: stub.date,
      img: null,
      excerpt: null,
    });
    console.log("~ (stub)", stub.url);
  } catch (e) {
    console.warn("✗", stub.url, e.message);
  }
}

// Sort newest first
articles.sort((a, b) => new Date(b.date) - new Date(a.date));

// 3. Generate RSS
const items = articles.map((a) => {
  const pub = new Date(a.date).toUTCString();
  const media = a.img ? `\n    <media:content url="${esc(a.img)}" medium="image"/>` : "";
  return `  <item>
    <title>${esc(a.title ?? "")}</title>
    <link>${esc(a.url)}</link>
    <guid isPermaLink="true">${esc(a.url)}</guid>
    <pubDate>${pub}</pubDate>
    <description>${esc(a.excerpt ?? "")}</description>${media}
  </item>`;
}).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Design for Manufacture</title>
    <link>${SITE}/</link>
    <description>Essays on engineering, technology, and communist politics</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://aidashpy.com/dfm-feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

writeFileSync(OUT, xml, "utf-8");
console.log(`\nWrote ${articles.length} items → ${OUT}`);
