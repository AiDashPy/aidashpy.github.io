// Uploads all images from public/images/ to R2 via the Worker,
// then rewrites /images/* paths in books.json to absolute Worker URLs.
//
// Usage:
//   ADMIN_TOKEN=<hash> node scripts/migrate-images-to-r2.mjs

import { readFileSync, readdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_URL = process.env.VITE_WORKER_URL ?? "https://aidashpy-api.adiashpy.workers.dev";
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
  console.error("Set ADMIN_TOKEN=<password-hash> before running.\n" +
    "The hash is the value of ADMIN_PASS_HASH in src/views/Admin.vue.");
  process.exit(1);
}

const EXTS = new Set([".webp", ".jpg", ".jpeg", ".png", ".gif", ".avif"]);
const MIME = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
               ".png": "image/png", ".gif": "image/gif", ".avif": "image/avif" };

const imagesDir = join(root, "public", "images");
const files = readdirSync(imagesDir).filter(f => EXTS.has(extname(f).toLowerCase()));

console.log(`Uploading ${files.length} images to R2 (${WORKER_URL})…`);
let ok = 0, skip = 0, fail = 0;

// Batch uploads to avoid hammering the Worker
const BATCH = 5;
for (let i = 0; i < files.length; i += BATCH) {
  await Promise.all(files.slice(i, i + BATCH).map(async (file) => {
    try {
      const ext = extname(file).toLowerCase();
      const ct = MIME[ext] ?? "application/octet-stream";
      const buf = readFileSync(join(imagesDir, file));

      // Check if already in R2 (HEAD-equivalent: GET with range 0-0)
      const check = await fetch(`${WORKER_URL}/images/${encodeURIComponent(file)}`, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });
      if (check.ok || check.status === 206) {
        skip++;
        process.stdout.write("·");
        return;
      }

      const res = await fetch(`${WORKER_URL}/images/${encodeURIComponent(file)}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": ct },
        body: buf,
      });
      if (res.ok) { ok++; process.stdout.write("✓"); }
      else { fail++; process.stdout.write("✗"); console.warn(`\n  ${file}: HTTP ${res.status}`); }
    } catch (e) {
      fail++;
      process.stdout.write("✗");
      console.warn(`\n  ${file}: ${e.message}`);
    }
  }));
}

console.log(`\n${ok} uploaded, ${skip} already present, ${fail} failed.`);
if (fail > 0) process.exit(1);

// Rewrite books.json: /images/x.webp → WORKER_URL/images/x.webp
console.log("\nUpdating image URLs in books.json…");
const booksRes = await fetch(`${WORKER_URL}/books.json`);
if (!booksRes.ok) { console.error("Failed to fetch books.json"); process.exit(1); }
const data = await booksRes.json();

let changed = 0;
for (const year of data) {
  for (const entry of (year.entries ?? [])) {
    if (entry.img && entry.img.startsWith("/images/")) {
      entry.img = `${WORKER_URL}/images/${entry.img.slice(8)}`;
      changed++;
    }
  }
}

if (changed === 0) {
  console.log("All image URLs already use Worker URLs — nothing to update.");
} else {
  const putRes = await fetch(`${WORKER_URL}/books.json`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  });
  if (putRes.ok) console.log(`✓ Updated ${changed} image URLs in books.json.`);
  else { console.error(`Failed to write books.json: HTTP ${putRes.status}`); process.exit(1); }
}
