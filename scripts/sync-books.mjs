import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

const WORKER_URL = process.env.VITE_WORKER_URL ?? "https://aidashpy-api.workers.dev";
const SITE_URL = "https://aidashpy.com";

// ── Fetch books.json from Worker ─────────────────────────────
let text;
try {
  const res = await fetch(`${WORKER_URL}/books.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  text = await res.text();
  writeFileSync(join(publicDir, "books.json"), text);
  console.log("books.json synced from Worker");
} catch (err) {
  console.warn(`Could not sync books.json (${err.message}) — using local copy`);
  text = null;
}

// ── Fetch missing cover images ───────────────────────────────
const data = JSON.parse(text ?? "[]");
const imgPaths = data.flatMap((y) => y.entries ?? []).map((e) => e.img).filter(Boolean);

const imagesDir = join(publicDir, "images");
mkdirSync(imagesDir, { recursive: true });

const toFetch = imgPaths.filter((p) => {
  // For absolute URLs (Worker/R2), check by filename; for relative paths, check full path
  const localPath = p.startsWith("http")
    ? join(imagesDir, basename(new URL(p).pathname))
    : join(publicDir, p);
  return !existsSync(localPath);
});

if (toFetch.length === 0) {
  console.log("all cover images present");
} else {
  console.log(`fetching ${toFetch.length} missing image(s)…`);
  await Promise.all(toFetch.map(async (p) => {
    try {
      const url = p.startsWith("http") ? p : `${SITE_URL}${p}`;
      const filename = basename(new URL(url).pathname);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(join(imagesDir, filename), Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`  skipped ${p}: ${err.message}`);
    }
  }));
  console.log("covers synced");
}
