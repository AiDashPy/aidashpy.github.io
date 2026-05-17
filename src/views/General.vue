<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";

const WORKER = import.meta.env.VITE_WORKER_URL ?? "https://aidashpy-api.adiashpy.workers.dev";

const PAINTINGS = [
  {
    src: `${WORKER}/images/ThePaintingNewPlanetNew.webp`,
    title: 'New Planet',
    titleDisplay: 'NEW PLANET',
    artist: 'Konstantin Yuon',
    artistDisplay: 'KONSTANTIN YUON',
    year: '1921',
    link: 'https://quod.lib.umich.edu/h/hart/x-939557/1',
  },
  {
    src: `${WORKER}/images/udaltsova_ural_river.webp`,
    title: 'Ural — Landscape with River',
    titleDisplay: 'URAL — LANDSCAPE WITH RIVER',
    artist: 'Nadezhda Udaltsova',
    artistDisplay: 'NADEZHDA UDALTSOVA',
    year: 'c. 1927',
    link: 'https://www.russianartcollection.com/en/product/ural-landscape/',
  },
  {
    src: `${WORKER}/images/udaltsova_ural_forest.webp`,
    title: 'Forests of the Ural',
    titleDisplay: 'FORESTS OF THE URAL',
    artist: 'Nadezhda Udaltsova',
    artistDisplay: 'NADEZHDA UDALTSOVA',
    year: '1926',
    link: 'https://www.russianartcollection.com/en/product/ural-landscape/',
  },
  {
    src: `${WORKER}/images/udaltsova_ural_sunset.webp`,
    title: 'Ural — Sunset',
    titleDisplay: 'URAL — SUNSET',
    artist: 'Nadezhda Udaltsova',
    artistDisplay: 'NADEZHDA UDALTSOVA',
    year: 'c. 1926',
    link: 'https://www.russianartcollection.com/en/product/ural-landscape/',
  },
  {
    src: `${WORKER}/images/udaltsova_ural_autumn.webp`,
    title: 'Ural — Autumn River',
    titleDisplay: 'URAL — AUTUMN RIVER',
    artist: 'Nadezhda Udaltsova',
    artistDisplay: 'NADEZHDA UDALTSOVA',
    year: 'c. 1927',
    link: 'https://www.russianartcollection.com/en/product/ural-landscape/',
  },
];

const created = ref(false);
const showOverlay = ref(true);
const currentBook = ref(null);
const inProgressBooks = ref([]);
const grainCanvas = ref(null);
const painting = ref(PAINTINGS[0]);
const paintingLoaded = ref(false);
const booksLoading = ref(true);

let grainTimer = null;
let bgStyleEl = null;
let overlayTimers = [];

function onOverlayEnd() { showOverlay.value = false; }

// ── Magnetic tiles ───────────────────────────────────────────
function handleTileMove(e) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
  const dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
  el.style.transform = `translate(${dx * 5}px, ${dy * 3}px)`;
  el.style.transition = "transform 60ms linear";
}

function handleTileLeave(e) {
  const el = e.currentTarget;
  el.style.transform = "translate(0,0)";
  el.style.transition = "transform 500ms cubic-bezier(.22,1,.36,1)";
}

// ── Film grain ───────────────────────────────────────────────
function startGrain() {
  const canvas = grainCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = 300;
  canvas.height = 300;
  function draw() {
    const img = ctx.createImageData(300, 300);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = (Math.random() * 20) | 0;
    }
    ctx.putImageData(img, 0, 0);
  }
  draw();
  grainTimer = setInterval(draw, 80);
}

// ── Palette extraction ───────────────────────────────────────
function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (p, q, t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

function extractPalette(img) {
  const SIZE = 48;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : (l > 0.5 ? d / (2 - max - min) : d / (max + min));
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    pixels.push({ h, s, l });
  }

  // Earthy accent: prefer mid-dark saturated pixels (target l≈0.38 for richness over brightness)
  const scored = pixels
    .filter(p => p.l > 0.1 && p.l < 0.72 && p.s > 0.12)
    .map(p => ({ ...p, score: p.s * (1 - Math.abs(p.l - 0.38) * 1.6) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  let aH = 0, aS = 0.55, aL = 0.38;
  if (scored.length) {
    let tw = 0, sh = 0, ss = 0, sl = 0;
    for (const p of scored) { const w = p.score; sh += p.h*w; ss += p.s*w; sl += p.l*w; tw += w; }
    // Clamp saturation (0.35–0.65) and lightness (0.28–0.44) for dark, earthy tones
    aH = sh/tw; aS = Math.max(0.35, Math.min(0.65, ss/tw)); aL = Math.max(0.28, Math.min(0.44, sl/tw));
  }

  // Background hue from the darkest pixels in the painting
  const darks = pixels.filter(p => p.l < 0.22 && p.s > 0.04);
  let bgH = aH, bgS = 0.10;
  if (darks.length > 8) {
    let sh = 0, ss = 0;
    for (const p of darks) { sh += p.h; ss += p.s; }
    bgH = sh / darks.length; bgS = Math.min(0.22, ss / darks.length);
  }

  const [ar, ag, ab] = hslToRgb(aH, aS, aL);
  const [sr, sg, sb] = hslToRgb(bgH, bgS * 0.55, 0.10);
  const [pr, pg, pb] = hslToRgb(bgH, bgS * 0.35, 0.074);
  const [cr, cg, cb] = hslToRgb(bgH, bgS * 0.25, 0.062);

  return {
    accent:    `rgb(${ar},${ag},${ab})`,
    accentRgb: `${ar},${ag},${ab}`,
    surface:   `rgb(${sr},${sg},${sb})`,
    bg:        `rgb(${pr},${pg},${pb})`,
    cap:       `rgb(${cr},${cg},${cb})`,
  };
}

function applyPalette(pal) {
  const root = document.documentElement;
  root.style.setProperty('--pg-accent',     pal.accent);
  root.style.setProperty('--pg-accent-rgb', pal.accentRgb);
  root.style.setProperty('--pg-surface',    pal.surface);
  root.style.setProperty('--pg-cap',        pal.cap);
  root.style.setProperty('--pg-bg',         pal.bg);
  if (bgStyleEl) bgStyleEl.textContent = `html, body { background-color: ${pal.bg} !important; }`;
}

onMounted(() => {
  bgStyleEl = document.createElement('style');
  bgStyleEl.textContent = 'html, body { background-color: #111010 !important; }';
  document.head.appendChild(bgStyleEl);

  painting.value = PAINTINGS[Math.floor(Math.random() * PAINTINGS.length)];

  created.value = true;

  // Reveal poster only after min time + painting loaded + books fetched (hard cap 5s)
  let _minElapsed = false, _paintReady = false, _booksReady = false;
  function tryReveal() {
    if (_minElapsed && _paintReady && _booksReady) showOverlay.value = false;
  }
  overlayTimers.push(setTimeout(() => { _minElapsed = true; tryReveal(); }, 1400));
  overlayTimers.push(setTimeout(() => { showOverlay.value = false; }, 5000));

  // Extract palette as soon as the painting loads
  const sampleImg = new Image();
  sampleImg.crossOrigin = 'anonymous';
  sampleImg.onload = () => {
    try { applyPalette(extractPalette(sampleImg)); } catch {}
    _paintReady = true;
    tryReveal();
  };
  sampleImg.onerror = () => { _paintReady = true; tryReveal(); };
  sampleImg.src = painting.value.src;

  fetch(`${WORKER}/books.json`)
    .then((r) => r.json())
    .then((data) => {
      const active = [];
      let recentBook = null;
      let recentTime = 0;
      data.forEach((year) => {
        (year.entries || []).forEach((e) => {
          if (e?.img) new Image().src = e.img;
          const isIP = e.finished === false || (e.finish && /^started/i.test(e.finish));
          if (isIP) {
            active.push(e);
          } else if (e?.date) {
            const [m, d, y] = e.date.split("/");
            const t = new Date(+y, +m - 1, +d).getTime();
            if (t > recentTime) { recentTime = t; recentBook = e; }
          }
        });
      });
      inProgressBooks.value = active;
      currentBook.value = recentBook;
      booksLoading.value = false;
      _booksReady = true;
      tryReveal();
    })
    .catch(() => {
      booksLoading.value = false;
      _booksReady = true;
      tryReveal();
    });

  startGrain();
});

onUnmounted(() => {
  overlayTimers.forEach(clearTimeout);
  overlayTimers = [];
  bgStyleEl?.remove();
  bgStyleEl = null;
  if (grainTimer) clearInterval(grainTimer);
  ['--pg-accent','--pg-accent-rgb','--pg-surface','--pg-cap','--pg-bg']
    .forEach(v => document.documentElement.style.removeProperty(v));
});
</script>

<template>
  <div class="page">
    <canvas ref="grainCanvas" class="grain" aria-hidden="true" />

    <div v-if="showOverlay" class="overlay" aria-hidden="true">
      <svg
        class="overlay-star"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style="color: var(--pg-accent, #c2201f)"
        @animationend="onOverlayEnd"
      >
        <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="currentColor"/>
      </svg>
    </div>

    <Transition name="fade">
      <div v-if="created" class="wrap">
        <div class="poster" :class="showOverlay ? 'poster-hidden' : ''">

          <!-- Top poster banner -->
          <div class="poster-top" aria-hidden="true">
            <svg class="pt-star" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="currentColor"/>
            </svg>
            <span class="pt-rule"></span>
            <span class="pt-year">2026</span>
          </div>

          <!-- Title block -->
          <div class="poster-title-block">
            <h1 class="p-title">AIDASHPY</h1>
            <div class="p-tagline">
              <span class="p-tl-rule"></span>
              <span class="p-tl-text">A READING LOG</span>
              <span class="p-tl-rule"></span>
            </div>
          </div>

          <!-- Painting -->
          <a :href="painting.link" target="_blank" rel="noopener noreferrer" class="poster-painting">
            <figure class="p-figure" :class="{ 'p-figure--loaded': paintingLoaded }">
              <img
                class="p-img"
                :class="{ 'p-img--loaded': paintingLoaded }"
                :src="painting.src"
                :alt="`${painting.title}, ${painting.artist}, ${painting.year}`"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                @load="paintingLoaded = true"
                @error="paintingLoaded = true"
              />
            </figure>
            <div class="p-cap">
              <span class="pc-title">{{ painting.titleDisplay }}</span>
              <span class="pc-dash" aria-hidden="true">—</span>
              <span>{{ painting.artistDisplay }}, {{ painting.year }}</span>
            </div>
          </a>

          <!-- Currently / recently reading -->
          <div v-if="booksLoading || inProgressBooks.length || currentBook" class="poster-section">
            <div class="ps-head">
              <svg class="ps-star" aria-hidden="true" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="currentColor"/>
              </svg>
              <span class="ps-label">{{ (booksLoading || inProgressBooks.length) ? 'CURRENTLY READING' : 'RECENTLY READ' }}</span>
            </div>
            <!-- Skeleton while fetching -->
            <div v-if="booksLoading" class="p-reading p-reading--skel" aria-hidden="true">
              <div class="pr-books">
                <div class="pr-book">
                  <div class="pr-thumb-empty pr-skel" />
                  <div class="pr-text">
                    <div class="pr-skel-line pr-skel-title" />
                    <div class="pr-skel-line pr-skel-author" />
                  </div>
                </div>
              </div>
            </div>
            <Transition v-else name="strip-fade">
              <RouterLink v-if="inProgressBooks.length" to="/" class="p-reading">
                <div class="pr-books">
                  <div v-for="b in inProgressBooks" :key="b.name" class="pr-book">
                    <img v-if="b.img" :src="b.img" class="pr-thumb" :alt="b.name" />
                    <div v-else class="pr-thumb-empty" />
                    <div class="pr-text">
                      <span class="pr-title">{{ b.name }}</span>
                      <span class="pr-author">{{ b.author }}</span>
                    </div>
                  </div>
                </div>
                <span class="pr-arr" aria-hidden="true">→</span>
              </RouterLink>
              <RouterLink v-else-if="currentBook" to="/" class="p-reading">
                <div class="pr-books">
                  <div class="pr-book">
                    <img v-if="currentBook.img" :src="currentBook.img" class="pr-thumb" :alt="currentBook.name" />
                    <div v-else class="pr-thumb-empty" />
                    <div class="pr-text">
                      <span class="pr-title">{{ currentBook.name }}</span>
                      <span class="pr-author">{{ currentBook.author }}</span>
                    </div>
                  </div>
                </div>
                <span class="pr-arr" aria-hidden="true">→</span>
              </RouterLink>
            </Transition>
          </div>

          <!-- Links -->
          <div class="poster-section">
            <div class="ps-head">
              <svg class="ps-star" aria-hidden="true" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="currentColor"/>
              </svg>
              <span class="ps-label">LINKS</span>
            </div>
            <nav class="p-links">
              <RouterLink
                to="/"
                class="plnk"
                @mousemove="handleTileMove"
                @mouseleave="handleTileLeave"
              >
                <span class="plnk-badge">01</span>
                <span class="plnk-name">ARCHIVE</span>
                <span class="plnk-cat">Reading</span>
                <span class="plnk-arr" aria-hidden="true">→</span>
              </RouterLink>
              <a
                href="https://letterboxd.com/aidashpy/"
                target="_blank"
                rel="noopener noreferrer"
                class="plnk"
                @mousemove="handleTileMove"
                @mouseleave="handleTileLeave"
              >
                <span class="plnk-badge">02</span>
                <span class="plnk-name">LETTERBOXD</span>
                <span class="plnk-cat">Film</span>
                <span class="plnk-arr" aria-hidden="true">→</span>
              </a>
              <a
                href="https://anilist.co/user/Aidashpy/"
                target="_blank"
                rel="noopener noreferrer"
                class="plnk"
                @mousemove="handleTileMove"
                @mouseleave="handleTileLeave"
              >
                <span class="plnk-badge">03</span>
                <span class="plnk-name">ANILIST</span>
                <span class="plnk-cat">Anime</span>
                <span class="plnk-arr" aria-hidden="true">→</span>
              </a>
            </nav>
          </div>

          <!-- Bottom banner -->
          <div class="poster-bot" aria-hidden="true">
            <span class="pb-rule"></span>
            <svg class="pb-star" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="currentColor"/>
            </svg>
            <span class="pb-rule"></span>
          </div>

        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&display=swap');

/* ── Page shell ─────────────────────────────────────────── */
.page {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pg-bg, #111010);
  padding: 2.5rem 1rem;
  box-sizing: border-box;
  transition: background 800ms ease;
}

/* ── Film grain ─────────────────────────────────────────── */
.grain {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 200;
  opacity: 0.065;
  mix-blend-mode: overlay;
}

/* ── Overlay ────────────────────────────────────────────── */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.overlay-star {
  width: 9rem;
  height: 9rem;
  animation: starReveal 1.2s cubic-bezier(.2,.9,.25,1) both;
  transform-origin: center;
}

@keyframes starReveal {
  0%   { transform: rotate(-90deg) scale(0.6); opacity: 0; }
  40%  { transform: rotate(20deg) scale(1.15); opacity: 1; }
  70%  { transform: rotate(-6deg) scale(1.05); opacity: 0.9; }
  100% { transform: rotate(-6deg) scale(1.05); opacity: 0; }
}

/* ── Wrap ───────────────────────────────────────────────── */
.wrap { width: 100%; max-width: 520px; }
@media (min-width: 768px)  { .wrap { max-width: 640px; } }
@media (min-width: 1280px) { .wrap { max-width: 760px; } }

.fade-enter-active { transition: opacity 300ms ease; }
.fade-enter-from   { opacity: 0; }

/* ── Poster ─────────────────────────────────────────────── */
.poster {
  font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
  background: var(--pg-surface, #141210);
  border: 2px solid var(--pg-accent, #c2201f);
  box-shadow:
    0 0 0 1px rgba(var(--pg-accent-rgb, 194, 32, 31), 0.18),
    inset 0 0 0 2px var(--pg-surface, #141210),
    0 24px 64px rgba(0,0,0,0.6);
  overflow: hidden;
  transition: opacity 500ms, transform 300ms ease,
              background 800ms ease, border-color 800ms ease, box-shadow 800ms ease;
}

.poster-hidden {
  opacity: 0;
  transform: scale(0.96) rotate(2deg);
}

/* ── Top banner ─────────────────────────────────────────── */
.poster-top {
  background: var(--pg-accent, #c2201f);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 1.5rem;
  transition: background 800ms ease;
}

.pt-star {
  width: 1rem;
  height: 1rem;
  color: rgba(20,18,16,0.55);
  animation: spin 12s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.pt-rule {
  flex: 1;
  height: 1px;
  background: rgba(20,18,16,0.25);
}

.pt-year {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  color: rgba(20,18,16,0.55);
  flex-shrink: 0;
}

/* ── Title block ────────────────────────────────────────── */
.poster-title-block {
  padding: 1.4rem 1.75rem 1.2rem;
  border-bottom: 2px solid var(--pg-accent, #c2201f);
  transition: border-color 800ms ease;
}

.p-title {
  font-family: 'Bebas Neue', 'Arial Narrow', Arial, sans-serif;
  font-size: clamp(3.8rem, 15vw, 9rem);
  font-weight: 400;
  color: #e8e0cc;
  letter-spacing: 0.05em;
  margin: 0;
  line-height: 0.85;
  text-transform: uppercase;
}

.p-tagline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.7rem;
}

.p-tl-rule {
  flex: 1;
  height: 1px;
  background: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.28);
  transition: background 800ms ease;
}

.p-tl-text {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.32em;
  color: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.55);
  white-space: nowrap;
  text-transform: uppercase;
  transition: color 800ms ease;
}

/* ── Painting ───────────────────────────────────────────── */
.poster-painting {
  display: block;
  text-decoration: none;
  border-bottom: 2px solid var(--pg-accent, #c2201f);
  transition: border-color 800ms ease;
}

.p-figure {
  margin: 0;
  display: block;
  min-height: clamp(180px, 40vh, 420px);
  background: linear-gradient(90deg, #161410 0%, #211f18 45%, #161410 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}
.p-figure--loaded {
  min-height: 0;
  background: none;
  animation: none;
}

.p-img {
  width: 100%;
  display: block;
  object-fit: contain;
  max-height: 42vh;
  filter: contrast(1.05) saturate(0.95);
  opacity: 0;
  transition: opacity 500ms ease;
}
.p-img--loaded { opacity: 1; }
@media (min-width: 768px)  { .p-img { max-height: 52vh; } }
@media (min-width: 1280px) { .p-img { max-height: 58vh; } }

.p-cap {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 1.75rem;
  background: var(--pg-cap, #0f0d0b);
  font-size: 0.6rem;
  letter-spacing: 0.07em;
  color: #3a3830;
  transition: background 800ms ease;
}

.pc-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-weight: 600;
  color: #504c44;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pc-dash {
  color: var(--pg-accent, #c2201f);
  opacity: 0.45;
  transition: color 800ms ease;
}

/* ── Poster section ─────────────────────────────────────── */
.poster-section { display: flex; flex-direction: column; }

/* Full-accent section header banner */
.ps-head {
  background: var(--pg-accent, #c2201f);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.36rem 1.75rem;
  transition: background 800ms ease;
}

.ps-star {
  width: 0.6rem;
  height: 0.6rem;
  color: rgba(20,18,16,0.45);
  flex-shrink: 0;
}

.ps-label {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: rgba(20,18,16,0.9);
  text-transform: uppercase;
}

/* ── Reading module ─────────────────────────────────────── */
.p-reading {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.75rem;
  border-bottom: 2px solid var(--pg-accent, #c2201f);
  text-decoration: none;
  transition: background 140ms, border-color 800ms ease;
}
.p-reading:hover { background: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.05); }

.pr-books {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
}

.pr-book {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.pr-thumb {
  width: 26px;
  height: 38px;
  object-fit: cover;
  border-radius: 0;
  flex-shrink: 0;
  opacity: 0.85;
}

.pr-thumb-empty {
  width: 26px;
  height: 38px;
  flex-shrink: 0;
  background: #1e1c1a;
}

.pr-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.pr-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #a8a298;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pr-author {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: #4a4840;
}

.pr-arr {
  font-size: 0.9rem;
  color: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.3);
  flex-shrink: 0;
  transition: color 140ms, transform 140ms;
}
.p-reading:hover .pr-arr { color: var(--pg-accent, #c2201f); transform: translateX(3px); }

.strip-fade-enter-active { transition: opacity 400ms ease, transform 400ms ease; }
.strip-fade-enter-from   { opacity: 0; transform: translateY(6px); }

/* ── Links ──────────────────────────────────────────────── */
.p-links {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #1c1a18;
}

.plnk {
  display: grid;
  grid-template-columns: 3rem 1fr auto auto;
  align-items: stretch;
  background: var(--pg-surface, #141210);
  text-decoration: none;
  transition: background 140ms;
  will-change: transform;
  overflow: hidden;
}
.plnk:hover { background: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.05); }

/* Accent badge column with the number */
.plnk-badge {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.9rem;
  background: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.1);
  border-right: 2px solid rgba(var(--pg-accent-rgb, 194, 32, 31), 0.22);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--pg-accent, #c2201f);
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  transition: background 140ms, border-color 140ms, color 800ms ease;
}
.plnk:hover .plnk-badge {
  background: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.18);
  border-right-color: rgba(var(--pg-accent-rgb, 194, 32, 31), 0.45);
}

.plnk-name {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  padding: 1rem 0.9rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #d4ccb8;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
  align-self: center;
  min-width: 0;
}
@media (min-width: 768px) { .plnk-name { font-size: 1.18rem; } }

.plnk-cat {
  align-self: center;
  font-size: 0.56rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #363430;
  padding: 0 0.5rem;
  white-space: nowrap;
}

.plnk-arr {
  align-self: center;
  font-size: 0.9rem;
  color: #252320;
  padding: 1rem 1.25rem 1rem 0.25rem;
  transition: color 140ms, transform 140ms;
}
.plnk:hover .plnk-arr { color: var(--pg-accent, #c2201f); transform: translateX(4px); }

/* ── Bottom banner ──────────────────────────────────────── */
.poster-bot {
  background: var(--pg-accent, #c2201f);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 1.5rem;
  transition: background 800ms ease;
}

.pb-rule {
  flex: 1;
  height: 1px;
  background: rgba(20,18,16,0.25);
}

.pb-star {
  width: 0.75rem;
  height: 0.75rem;
  color: rgba(20,18,16,0.45);
}

/* ── Mobile (≤ 479px) ───────────────────────────────────── */
@media (max-width: 479px) {
  .page { padding: 1rem 0.5rem; }

  .poster-top  { padding: 0.4rem 1.1rem; }
  .poster-bot  { padding: 0.28rem 1.1rem; }

  .poster-title-block { padding: 1rem 1.25rem 0.9rem; }
  .p-tagline { gap: 0.5rem; }

  .p-cap { padding: 0.45rem 1.25rem; }

  .ps-head { padding: 0.34rem 1.25rem; }

  .p-reading { padding: 0.8rem 1.25rem; }

  .plnk-badge { padding: 0.85rem 0.7rem; font-size: 0.7rem; }
  .plnk-name  { padding: 0.85rem 0.7rem; font-size: 0.96rem; }
  .plnk-cat   { display: none; }
  .plnk-arr   { padding: 0.85rem 1rem 0.85rem 0.2rem; }
}

/* ── Loading skeletons ──────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}

.p-reading--skel {
  cursor: default;
  pointer-events: none;
}

.pr-skel {
  background: linear-gradient(90deg, #1c1a14 0%, #252218 45%, #1c1a14 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.pr-skel-line {
  border-radius: 2px;
  background: linear-gradient(90deg, #1c1a14 0%, #252218 45%, #1c1a14 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.pr-skel-title  { height: 13px; width: 58%; }
.pr-skel-author { height: 9px; width: 36%; animation-delay: 0.2s; }
</style>
