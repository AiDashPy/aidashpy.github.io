import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

// ── Fetch books.json ─────────────────────────────────────
let text;
try {
  const res = await fetch("https://aidashpy.com/books.json");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  text = await res.text();
  writeFileSync(join(publicDir, "books.json"), text);
  console.log("books.json synced");
} catch (err) {
  console.warn(`Could not sync books.json (${err.message}) — using local copy`);
  text = null;
}

// ── Fetch missing cover images ───────────────────────────
const data = JSON.parse(text ?? '[]');
const imgPaths = data
  .flatMap(y => y.entries ?? [])
  .map(e => e.img)
  .filter(p => p && p.startsWith("/images/"));

const imagesDir = join(publicDir, "images");
mkdirSync(imagesDir, { recursive: true });

const missing = imgPaths.filter(p => !existsSync(join(publicDir, p)));

if (missing.length === 0) {
  console.log("all cover images present");
} else {
  console.log(`fetching ${missing.length} missing image(s)…`);
  await Promise.all(missing.map(async (p) => {
    try {
      const res = await fetch(`https://aidashpy.com${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(join(publicDir, p), Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      console.warn(`  skipped ${p}: ${err.message}`);
    }
  }));
  console.log("covers synced");
}
