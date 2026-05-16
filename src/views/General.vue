<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { RouterLink } from "vue-router";

const created = ref(false);
const showOverlay = ref(true);
const currentBook = ref(null);
const inProgressBooks = ref([]);
const grainCanvas = ref(null);

let grainTimer = null;
let bgStyleEl = null;

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

onMounted(() => {
  bgStyleEl = document.createElement('style');
  bgStyleEl.textContent = 'html, body { background-color: #1f1f21 !important; }';
  document.head.appendChild(bgStyleEl);

  created.value = true;
  setTimeout(() => { showOverlay.value = false; }, 1400);

  new Image().src = "/images/ThePaintingNewPlanetNew.webp";

  const workerUrl = import.meta.env.VITE_WORKER_URL ?? "https://aidashpy-api.adiashpy.workers.dev";
  fetch(`${workerUrl}/books.json`)
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
    })
    .catch(() => {});

  startGrain();
});

onUnmounted(() => {
  bgStyleEl?.remove();
  bgStyleEl = null;
  if (grainTimer) clearInterval(grainTimer);
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
        @animationend="onOverlayEnd"
      >
        <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="#c2201f"/>
      </svg>
    </div>

    <Transition name="fade">
      <div v-if="created" class="wrap">
        <div class="poster" :class="showOverlay ? 'poster-hidden' : ''">

          <!-- Top poster banner -->
          <div class="poster-top" aria-hidden="true">
            <span class="pt-star">★</span>
            <span class="pt-rule"></span>
            <span class="pt-year">MMXXVI</span>
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
          <a href="https://quod.lib.umich.edu/h/hart/x-939557/1" target="_blank" rel="noopener noreferrer" class="poster-painting">
            <figure class="p-figure">
              <img
                class="p-img"
                src="/images/ThePaintingNewPlanetNew.webp"
                alt="New Planet, Konstantin Yuon, 1921"
                loading="eager"
                fetchpriority="high"
                decoding="async"
              />
            </figure>
            <div class="p-cap">
              <span class="pc-title">NEW PLANET</span>
              <span class="pc-dash" aria-hidden="true">—</span>
              <span>KONSTANTIN YUON, 1921</span>
            </div>
          </a>

          <!-- Currently / recently reading -->
          <div v-if="inProgressBooks.length || currentBook" class="poster-section">
            <div class="ps-head">
              <span class="ps-star" aria-hidden="true">★</span>
              <span class="ps-label">{{ inProgressBooks.length ? 'CURRENTLY READING' : 'RECENTLY READ' }}</span>
            </div>
            <Transition name="strip-fade">
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
              <span class="ps-star" aria-hidden="true">★</span>
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
            <span class="pb-star">★</span>
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
  background: #111010;
  padding: 2.5rem 1rem;
  box-sizing: border-box;
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
  background: #141210;
  border: 2px solid #c2201f;
  box-shadow:
    0 0 0 1px rgba(194,32,31,0.18),
    inset 0 0 0 2px #141210,
    0 24px 64px rgba(0,0,0,0.6);
  overflow: hidden;
  transition: opacity 500ms, transform 300ms ease;
}

.poster-hidden {
  opacity: 0;
  transform: scale(0.96) rotate(2deg);
}

/* ── Top banner ─────────────────────────────────────────── */
.poster-top {
  background: #c2201f;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.45rem 1.5rem;
}

.pt-star {
  color: rgba(20,18,16,0.55);
  font-size: 1rem;
  line-height: 1;
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
  border-bottom: 2px solid #c2201f;
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
  background: rgba(194,32,31,0.28);
}

.p-tl-text {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.32em;
  color: rgba(194,32,31,0.55);
  white-space: nowrap;
  text-transform: uppercase;
}

/* ── Painting ───────────────────────────────────────────── */
.poster-painting {
  display: block;
  text-decoration: none;
  border-bottom: 2px solid #c2201f;
}

.p-figure { margin: 0; display: block; }

.p-img {
  width: 100%;
  display: block;
  object-fit: contain;
  max-height: 42vh;
  filter: contrast(1.05) saturate(0.95);
}
@media (min-width: 768px)  { .p-img { max-height: 52vh; } }
@media (min-width: 1280px) { .p-img { max-height: 58vh; } }

.p-cap {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 1.75rem;
  background: #0f0d0b;
  font-size: 0.6rem;
  letter-spacing: 0.07em;
  color: #3a3830;
}

.pc-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-weight: 600;
  color: #504c44;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.pc-dash {
  color: #c2201f;
  opacity: 0.45;
}

/* ── Poster section ─────────────────────────────────────── */
.poster-section { display: flex; flex-direction: column; }

/* Full-red section header banner */
.ps-head {
  background: #c2201f;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.36rem 1.75rem;
}

.ps-star {
  color: rgba(20,18,16,0.45);
  font-size: 0.68rem;
  flex-shrink: 0;
}

.ps-label {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #141210;
  text-transform: uppercase;
}

/* ── Reading module ─────────────────────────────────────── */
.p-reading {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.75rem;
  border-bottom: 2px solid #c2201f;
  text-decoration: none;
  transition: background 140ms;
}
.p-reading:hover { background: rgba(194,32,31,0.05); }

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
  color: rgba(194,32,31,0.3);
  flex-shrink: 0;
  transition: color 140ms, transform 140ms;
}
.p-reading:hover .pr-arr { color: #c2201f; transform: translateX(3px); }

.strip-fade-enter-active { transition: opacity 400ms ease, transform 400ms ease; }
.strip-fade-enter-from   { opacity: 0; transform: translateY(6px); }

/* ── Links ──────────────────────────────────────────────── */
.p-links { display: flex; flex-direction: column; }

.plnk {
  display: grid;
  grid-template-columns: 3rem 1fr auto auto;
  align-items: stretch;
  border-bottom: 1px solid #1c1a18;
  text-decoration: none;
  transition: background 140ms;
  will-change: transform;
  overflow: hidden;
}
.plnk:hover { background: rgba(194,32,31,0.05); }

/* Red badge column with the number */
.plnk-badge {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.9rem;
  background: rgba(194,32,31,0.1);
  border-right: 2px solid rgba(194,32,31,0.22);
  font-size: 0.75rem;
  font-weight: 700;
  color: #c2201f;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  transition: background 140ms, border-color 140ms;
}
.plnk:hover .plnk-badge {
  background: rgba(194,32,31,0.18);
  border-right-color: rgba(194,32,31,0.45);
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
.plnk:hover .plnk-arr { color: #c2201f; transform: translateX(4px); }

/* ── Bottom banner ──────────────────────────────────────── */
.poster-bot {
  background: #c2201f;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 1.5rem;
}

.pb-rule {
  flex: 1;
  height: 1px;
  background: rgba(20,18,16,0.25);
}

.pb-star {
  color: rgba(20,18,16,0.45);
  font-size: 0.8rem;
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

  /* link rows: tighter padding, hide low-contrast category */
  .plnk-badge { padding: 0.85rem 0.7rem; font-size: 0.7rem; }
  .plnk-name  { padding: 0.85rem 0.7rem; font-size: 0.96rem; }
  .plnk-cat   { display: none; }
  .plnk-arr   { padding: 0.85rem 1rem 0.85rem 0.2rem; }
}
</style>
