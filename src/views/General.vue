<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
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
    src: `${WORKER}/images/udaltsova_ural_forest_2.webp`,
    title: 'Forests of the Ural',
    titleDisplay: 'FORESTS OF THE URAL',
    artist: 'Nadezhda Udaltsova',
    artistDisplay: 'NADEZHDA UDALTSOVA',
    year: '1926',
    link: 'https://www.russianartcollection.com/en/product/ural-landscape/',
  },
  {
    src: `${WORKER}/images/udaltsova_ural_sunset_2.webp`,
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
  {
    src: `${WORKER}/images/drevin_altai_dry_birch.webp`,
    title: 'Altai. Dry Birch',
    titleDisplay: 'ALTAI. DRY BIRCH',
    artist: 'Aleksandr Drevin',
    artistDisplay: 'ALEKSANDR DREVIN',
    year: '1930',
    link: 'https://macdougallauction.com/en/catalogue/view?id=16179',
  },
  {
    src: `${WORKER}/images/drevin_gazelles.webp`,
    title: 'Gazelles',
    titleDisplay: 'GAZELLES',
    artist: 'Aleksandr Drevin',
    artistDisplay: 'ALEKSANDR DREVIN',
    year: '1930–31',
    link: 'https://commons.wikimedia.org/wiki/File:Drevin_gazeli.jpg',
  },
];

const created = ref(false);
const showOverlay = ref(true);
const paletteReady = ref(false);
const currentBook = ref(null);
const inProgressBooks = ref([]);
const grainCanvas = ref(null);
const wrapRef = ref(null);
const painting = ref(PAINTINGS[0]);
const paintingLoaded = ref(false);
const booksLoading = ref(true);
let grainTimer = null;
let bgStyleEl = null;
let overlayTimers = [];
let resizeTimer = null;

function fitToViewport() {
  const el = wrapRef.value;
  if (!el) return;
  el.style.zoom = '';
  if (window.innerWidth < 768) return;
  const pageEl = el.parentElement;
  const padY = parseFloat(getComputedStyle(pageEl).paddingTop) * 2;
  const available = window.innerHeight - padY;
  const natural = el.offsetHeight;
  if (natural > available) el.style.zoom = String(available / natural);
}

function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitToViewport, 80);
}

// Re-fit whenever content height changes (books load in, painting renders)
watch(booksLoading, (v) => { if (!v) nextTick(fitToViewport); });
watch(paintingLoaded, (v) => { if (v) nextTick(fitToViewport); });

function onOverlayEnd() { showOverlay.value = false; }

// ── Film grain ───────────────────────────────────────────────
function startGrain() {
  const canvas = grainCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = 300;
  canvas.height = 300;
  let last = 0;
  function draw(ts) {
    grainTimer = requestAnimationFrame(draw);
    if (ts - last < 150) return;
    last = ts;
    const img = ctx.createImageData(300, 300);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = (Math.random() * 20) | 0;
    }
    ctx.putImageData(img, 0, 0);
  }
  grainTimer = requestAnimationFrame(draw);
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
  overlayTimers.push(setTimeout(() => { paletteReady.value = true; showOverlay.value = false; }, 5000));

  // Extract palette as soon as the painting loads
  const sampleImg = new Image();
  sampleImg.crossOrigin = 'anonymous';
  sampleImg.onload = () => {
    try { applyPalette(extractPalette(sampleImg)); } catch {}
    paletteReady.value = true;
    _paintReady = true;
    tryReveal();
    requestAnimationFrame(fitToViewport);
  };
  sampleImg.onerror = () => {
    paletteReady.value = true;
    _paintReady = true;
    tryReveal();
    requestAnimationFrame(fitToViewport);
  };
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
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  overlayTimers.forEach(clearTimeout);
  overlayTimers = [];
  bgStyleEl?.remove();
  bgStyleEl = null;
  if (grainTimer) cancelAnimationFrame(grainTimer);
  window.removeEventListener('resize', onResize);
  clearTimeout(resizeTimer);
  ['--pg-accent','--pg-accent-rgb','--pg-surface','--pg-cap','--pg-bg']
    .forEach(v => document.documentElement.style.removeProperty(v));
});
</script>

<template>
  <div class="page">
    <canvas ref="grainCanvas" class="grain" aria-hidden="true" />

  <div v-if="showOverlay && paletteReady" class="overlay" aria-hidden="true">
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
      <div v-if="created" ref="wrapRef" class="wrap">
        <div class="c-canvas" :class="showOverlay ? 'c-hidden' : ''">
          <div class="c-circle-deco" aria-hidden="true"></div>
          <div class="c-corner-rule" aria-hidden="true"></div>
          <div class="c-ghost-title" aria-hidden="true">AI<br>DA</div>

          <div class="c-identity">
            <div class="c-eyebrow">A Reading Log</div>
            <div class="c-name">AIDASHPY</div>
          </div>

          <a :href="painting.link" target="_blank" rel="noopener noreferrer" class="c-painting-block">
            <div class="c-frame" :class="{ 'c-frame--loaded': paintingLoaded }">
              <img
                class="c-img"
                :class="{ 'c-img--loaded': paintingLoaded }"
                :src="painting.src"
                :alt="`${painting.title}, ${painting.artist}, ${painting.year}`"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                @load="paintingLoaded = true"
                @error="paintingLoaded = true"
              />
            </div>
            <div class="c-cap">
              <div class="c-cap-bar"></div>
              <div class="c-cap-text">
                <span class="c-cap-title">{{ painting.titleDisplay }}</span>
                <span class="c-cap-dash" aria-hidden="true">—</span>
                <span class="c-cap-sub">{{ painting.artistDisplay }}, {{ painting.year }}</span>
              </div>
            </div>
          </a>

          <template v-if="booksLoading || inProgressBooks.length || currentBook">
            <div class="c-slash">
              <div class="c-slash-line"></div>
              <div class="c-slash-tag">{{ (booksLoading || inProgressBooks.length) ? 'Currently Reading' : 'Recently Read' }}</div>
            </div>
            <div v-if="booksLoading" class="c-reading-strip c-reading-skel" aria-hidden="true">
              <div class="c-rs-accent"></div>
              <div class="c-rs-body">
                <div class="c-rs-thumb c-rs-thumb-empty c-skel"></div>
                <div class="c-rs-text">
                  <div class="c-skel-line c-skel-title"></div>
                  <div class="c-skel-line c-skel-author"></div>
                </div>
              </div>
            </div>
            <Transition v-else name="strip-fade">
              <RouterLink v-if="inProgressBooks.length" to="/log" class="c-reading-strip">
                <div class="c-rs-accent"></div>
                <div class="c-rs-body">
                  <div v-for="b in inProgressBooks" :key="b.name" class="c-rs-book">
                    <img v-if="b.img" :src="b.img" class="c-rs-thumb" :alt="b.name" />
                    <div v-else class="c-rs-thumb c-rs-thumb-empty"></div>
                    <div class="c-rs-text">
                      <span class="c-rs-label">Now</span>
                      <span class="c-rs-title">{{ b.name }}</span>
                      <span class="c-rs-author">{{ b.author }}</span>
                    </div>
                  </div>
                </div>
                <span class="c-rs-arr">→</span>
              </RouterLink>
              <RouterLink v-else-if="currentBook" to="/log" class="c-reading-strip">
                <div class="c-rs-accent"></div>
                <div class="c-rs-body">
                  <img v-if="currentBook.img" :src="currentBook.img" class="c-rs-thumb" :alt="currentBook.name" />
                  <div v-else class="c-rs-thumb c-rs-thumb-empty"></div>
                  <div class="c-rs-text">
                    <span class="c-rs-label">Recently</span>
                    <span class="c-rs-title">{{ currentBook.name }}</span>
                    <span class="c-rs-author">{{ currentBook.author }}</span>
                  </div>
                </div>
                <span class="c-rs-arr">→</span>
              </RouterLink>
            </Transition>
          </template>

          <div class="c-slash">
            <div class="c-slash-line"></div>
            <div class="c-slash-tag">Links</div>
          </div>

          <div class="c-links">
            <RouterLink to="/log" class="c-lnk">
              <div class="c-lnk-ghost" aria-hidden="true">01</div>
              <div class="c-lnk-inner">
                <div class="c-lnk-accent"></div>
                <div class="c-lnk-body">
                  <span class="c-lnk-num">01</span>
                  <div class="c-lnk-div"></div>
                  <span class="c-lnk-name">ARCHIVE</span>
                  <span class="c-lnk-cat">Reading</span>
                  <span class="c-lnk-arr">→</span>
                </div>
              </div>
            </RouterLink>
            <a href="https://letterboxd.com/aidashpy/" target="_blank" rel="noopener noreferrer" class="c-lnk">
              <div class="c-lnk-ghost" aria-hidden="true">02</div>
              <div class="c-lnk-inner">
                <div class="c-lnk-accent"></div>
                <div class="c-lnk-body">
                  <span class="c-lnk-num">02</span>
                  <div class="c-lnk-div"></div>
                  <span class="c-lnk-name">LETTERBOXD</span>
                  <span class="c-lnk-cat">Film</span>
                  <span class="c-lnk-arr">→</span>
                </div>
              </div>
            </a>
            <a href="https://anilist.co/user/Aidashpy/" target="_blank" rel="noopener noreferrer" class="c-lnk">
              <div class="c-lnk-ghost" aria-hidden="true">03</div>
              <div class="c-lnk-inner">
                <div class="c-lnk-accent"></div>
                <div class="c-lnk-body">
                  <span class="c-lnk-num">03</span>
                  <div class="c-lnk-div"></div>
                  <span class="c-lnk-name">ANILIST</span>
                  <span class="c-lnk-cat">Anime</span>
                  <span class="c-lnk-arr">→</span>
                </div>
              </div>
            </a>
          </div>

          <div class="c-foot">
            <div class="c-foot-rule"></div>
            <svg class="c-foot-star" viewBox="0 0 100 100">
              <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="rgba(var(--pg-accent-rgb, 194,32,31),0.38)"/>
            </svg>
            <div class="c-foot-rule"></div>
          </div>
        </div>

      </div>
    </Transition>
  </div>
</template>

<style scoped>
@import '@fontsource/bebas-neue/index.css';
@import '@fontsource/oswald/400.css';
@import '@fontsource/oswald/500.css';
@import '@fontsource/oswald/600.css';
@import '@fontsource/oswald/700.css';
@import '@fontsource/barlow-condensed/400.css';
@import '@fontsource/barlow-condensed/500.css';
@import '@fontsource/barlow-condensed/600.css';
@import '@fontsource/barlow-condensed/700.css';

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
  opacity: 0.08;
  will-change: transform;
}

/* ── Overlay ────────────────────────────────────────────── */
.overlay {
  position: fixed;
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

/* ── Mobile (≤ 479px) ───────────────────────────────────── */
@media (max-width: 479px) {
  .page { padding: 1rem 0.5rem; }
}

/* ── Constructivist canvas ───────────────────────────────── */
.c-canvas {
  position: relative;
  width: 100%;
  font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
  transition: opacity 500ms, transform 300ms ease;
}

.c-hidden { opacity: 0; transform: scale(0.96) rotate(2deg); }

.c-circle-deco {
  position: absolute;
  top: -3rem;
  right: -5rem;
  width: 18rem;
  height: 18rem;
  border: 2px solid rgba(var(--pg-accent-rgb, 194,32,31), 0.06);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  transition: border-color 800ms ease;
}
.c-circle-deco::after {
  content: '';
  position: absolute;
  inset: 2rem;
  border: 1px solid rgba(var(--pg-accent-rgb, 194,32,31), 0.035);
  border-radius: 50%;
  transition: border-color 800ms ease;
}

.c-corner-rule {
  position: absolute;
  top: 2.4rem;
  right: 0;
  width: 38%;
  height: 2px;
  background: var(--pg-accent, #b81c1c);
  transform: rotate(-4.5deg);
  transform-origin: right;
  z-index: 0;
  transition: background 800ms ease;
}

.c-ghost-title {
  position: absolute;
  top: -1rem;
  left: -1.5rem;
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: clamp(7rem, 28vw, 12rem);
  line-height: 0.82;
  color: rgba(255,255,255,0.025);
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

/* ── Identity ────────────────────────────────────────────── */
.c-identity {
  position: relative;
  z-index: 1;
  padding: 0 0 0 1.2rem;
  border-left: 4px solid var(--pg-accent, #b81c1c);
  margin-bottom: 1rem;
  transition: border-color 800ms ease;
}

.c-eyebrow {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.45em;
  color: rgba(var(--pg-accent-rgb, 184,28,28), 0.5);
  text-transform: uppercase;
  margin-bottom: 0.2rem;
  transition: color 800ms ease;
}

.c-name {
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: clamp(3rem, 14vw, 5.5rem);
  line-height: 0.88;
  color: #e2d9c2;
  letter-spacing: 0.03em;
}

/* ── Painting ────────────────────────────────────────────── */
.c-painting-block {
  position: relative;
  z-index: 1;
  display: block;
  text-decoration: none;
}

.c-frame {
  position: relative;
  overflow: hidden;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 36px), calc(100% - 36px) 100%, 0 100%);
  background: #1a1714;
  min-height: clamp(160px, 38vh, 380px);
}
.c-frame--loaded { min-height: 0; background: none; }

.c-frame::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  background: var(--pg-accent, #b81c1c);
  z-index: 2;
  transition: background 800ms ease;
}

.c-frame::after {
  content: '';
  position: absolute;
  bottom: 36px; right: 0;
  width: 52px; height: 2px;
  background: var(--pg-accent, #b81c1c);
  transform: rotate(-45deg);
  transform-origin: right center;
  z-index: 2;
  transition: background 800ms ease;
}

.c-img {
  display: block;
  width: 100%;
  height: auto;
  filter: contrast(1.04) saturate(0.92);
  opacity: 0;
  transition: opacity 600ms ease;
}
.c-img--loaded { opacity: 1; }

.c-cap {
  display: flex;
  align-items: stretch;
  margin-top: 3px;
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
}

.c-cap-bar {
  width: 3px;
  background: rgba(var(--pg-accent-rgb, 184,28,28), 0.4);
  flex-shrink: 0;
  transition: background 800ms ease;
}

.c-cap-text {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.3rem 0.55rem;
  padding: 0.45rem 1.2rem 0.45rem 0.9rem;
  background: var(--pg-surface, #131110);
  flex: 1;
  transition: background 800ms ease;
}

.c-cap-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #5c5648;
  text-transform: uppercase;
}

.c-cap-dash { color: rgba(var(--pg-accent-rgb, 184,28,28), 0.45); font-size: 0.6rem; transition: color 800ms ease; }

.c-cap-sub { font-size: 0.6rem; letter-spacing: 0.08em; color: #3c3830; text-transform: uppercase; }

/* ── Slash dividers ──────────────────────────────────────── */
.c-slash {
  position: relative;
  height: 2.8rem;
  margin: 0.5rem 0;
  overflow: visible;
}

.c-slash-line {
  position: absolute;
  left: -5%;
  width: 110%;
  height: 2px;
  background: var(--pg-accent, #b81c1c);
  top: 50%;
  transform: rotate(-3.5deg);
  transition: background 800ms ease;
}

.c-slash-tag {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.5em;
  color: rgba(var(--pg-accent-rgb, 184,28,28), 0.5);
  background: var(--pg-bg, #0d0b09);
  padding: 0 0.75rem;
  text-transform: uppercase;
  white-space: nowrap;
  transition: color 800ms ease, background 800ms ease;
}

/* ── Reading strip ───────────────────────────────────────── */
.c-reading-strip {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: stretch;
  background: var(--pg-surface, #131110);
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 14px 100%);
  text-decoration: none;
  transition: filter 100ms, background 800ms ease;
}
.c-reading-strip:hover { filter: brightness(1.18); }

.c-rs-accent {
  width: 4px;
  background: var(--pg-accent, #b81c1c);
  flex-shrink: 0;
  transition: background 800ms ease;
}

.c-rs-body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.65rem 1.2rem 0.65rem 1rem;
  flex: 1;
  min-width: 0;
}

.c-rs-book {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.c-rs-thumb {
  width: 24px; height: 34px;
  object-fit: cover;
  flex-shrink: 0;
  background: #221e18;
}

.c-rs-thumb-empty {
  width: 24px; height: 34px;
  background: #221e18;
  border: 1px solid #2e2a22;
  flex-shrink: 0;
}

.c-rs-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

.c-rs-label {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.48rem;
  font-weight: 700;
  letter-spacing: 0.35em;
  color: var(--pg-accent, #b81c1c);
  text-transform: uppercase;
  transition: color 800ms ease;
}

.c-rs-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2d9c2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.c-rs-author { font-size: 0.65rem; color: #8a826e; letter-spacing: 0.06em; }

.c-rs-arr {
  font-size: 0.8rem;
  color: rgba(var(--pg-accent-rgb, 184,28,28), 0.3);
  padding-right: 1.5rem;
  flex-shrink: 0;
  align-self: center;
  transition: color 800ms ease;
}

.strip-fade-enter-active { transition: opacity 400ms ease, transform 400ms ease; }
.strip-fade-enter-from   { opacity: 0; transform: translateY(6px); }

@keyframes shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}

.c-reading-skel { cursor: default; pointer-events: none; }

.c-skel {
  background: linear-gradient(90deg, #1c1a14 0%, #252218 45%, #1c1a14 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.c-skel-line {
  border-radius: 2px;
  background: linear-gradient(90deg, #1c1a14 0%, #252218 45%, #1c1a14 100%);
  background-size: 200% 100%;
  animation: shimmer 1.8s ease-in-out infinite;
}

.c-skel-title  { height: 13px; width: 58%; }
.c-skel-author { height: 9px;  width: 36%; animation-delay: 0.2s; }

/* ── Links — staircase parallelograms ────────────────────── */
.c-links {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.c-lnk {
  position: relative;
  display: block;
  text-decoration: none;
  clip-path: polygon(0 0, 100% 0, calc(100% - 20px) 100%, 0 100%);
  background: var(--pg-surface, #131110);
  transition: background 100ms;
}
.c-lnk:hover { filter: brightness(1.14); }

.c-lnk:nth-child(1) { margin-left: 0; }
.c-lnk:nth-child(2) { margin-left: 1.15rem; }
.c-lnk:nth-child(3) { margin-left: 2.3rem; }

.c-lnk-ghost {
  position: absolute;
  right: 2.8rem;
  top: 50%;
  translate: 0 -50%;
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: 5rem;
  line-height: 1;
  color: rgba(255,255,255,0.028);
  pointer-events: none;
  user-select: none;
}

.c-lnk-inner {
  display: flex;
  align-items: stretch;
  padding-right: 2.2rem;
}

.c-lnk-accent {
  width: 4px;
  background: var(--pg-accent, #b81c1c);
  opacity: 0.65;
  flex-shrink: 0;
  transition: opacity 100ms, background 800ms ease;
}
.c-lnk:hover .c-lnk-accent { opacity: 1; }

.c-lnk-body {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 0.8rem 0.8rem 0.9rem;
  min-width: 0;
}

.c-lnk-num {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--pg-accent, #b81c1c);
  letter-spacing: 0.1em;
  width: 1.4rem;
  flex-shrink: 0;
  transition: color 800ms ease;
}

.c-lnk-div {
  width: 1px;
  height: 1.1rem;
  background: rgba(var(--pg-accent-rgb, 184,28,28), 0.25);
  flex-shrink: 0;
  transition: background 800ms ease;
}

.c-lnk-name {
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: 1.7rem;
  letter-spacing: 0.07em;
  color: #e2d9c2;
  flex: 1;
  line-height: 1;
}

.c-lnk-cat {
  font-size: 0.47rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.16);
  flex-shrink: 0;
}

.c-lnk-arr {
  font-size: 0.85rem;
  color: rgba(var(--pg-accent-rgb, 184,28,28), 0.25);
  flex-shrink: 0;
  padding-right: 0.4rem;
  transition: color 100ms, translate 100ms;
}
.c-lnk:hover .c-lnk-arr { color: var(--pg-accent, #b81c1c); translate: 4px 0; }

/* ── Constructivist footer ───────────────────────────────── */
.c-foot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1rem;
}

.c-foot-rule {
  flex: 1;
  height: 1px;
  background: rgba(var(--pg-accent-rgb, 184,28,28), 0.16);
  transition: background 800ms ease;
}

.c-foot-star { width: 9px; height: 9px; flex-shrink: 0; }

</style>
