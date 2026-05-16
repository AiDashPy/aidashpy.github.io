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
    <!-- Film grain overlay -->
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
        <div
          class="card"
          :class="showOverlay ? 'card-hidden' : ''"
        >
          <header class="c-header">
            <h1 class="c-title">aidashpy</h1>
            <span class="c-star" aria-hidden="true">★</span>
          </header>

          <div class="c-rule"></div>

          <a href="https://quod.lib.umich.edu/h/hart/x-939557/1" target="_blank" rel="noopener noreferrer" class="painting-wrap">
            <figure class="painting">
              <img
                class="painting-img"
                src="/images/ThePaintingNewPlanetNew.webp"
                alt="New Planet, Konstantin Yuon, 1921"
                loading="eager"
                fetchpriority="high"
                decoding="async"
              />
              <figcaption class="painting-cap">
                <span>New Planet</span>
                <span class="cap-dot">·</span>
                <span>Konstantin Yuon</span>
                <span class="cap-dot">·</span>
                <span>1921</span>
              </figcaption>
            </figure>
          </a>

          <!-- Currently reading module / recently read strip -->
          <Transition name="strip-fade">
            <RouterLink v-if="inProgressBooks.length" to="/" class="reading-module">
              <div class="rm-header">
                <span class="rm-label">currently reading</span>
                <span v-if="inProgressBooks.length > 1" class="rm-count">{{ inProgressBooks.length }}</span>
              </div>
              <div class="rm-books">
                <div v-for="b in inProgressBooks" :key="b.name" class="rm-book">
                  <img v-if="b.img" :src="b.img" class="rm-thumb" :alt="b.name" />
                  <div v-else class="rm-thumb-empty" />
                  <div class="rm-text">
                    <span class="rm-title">{{ b.name }}</span>
                    <span class="rm-author">{{ b.author }}</span>
                  </div>
                </div>
              </div>
              <span class="rm-arrow">→</span>
            </RouterLink>
            <RouterLink v-else-if="currentBook" to="/" class="recent-strip">
              <img v-if="currentBook.img" :src="currentBook.img" class="recent-thumb" :alt="currentBook.name" />
              <div class="recent-text">
                <span class="recent-label">recently read</span>
                <span class="recent-title">{{ currentBook.name }}</span>
                <span class="recent-author">{{ currentBook.author }}</span>
              </div>
              <span class="recent-arrow">→</span>
            </RouterLink>
          </Transition>

          <nav class="links">
            <div class="links-label">links</div>
            <div class="links-grid">
              <RouterLink
                to="/"
                class="lnk"
                @mousemove="handleTileMove"
                @mouseleave="handleTileLeave"
              >
                <span class="lnk-cat">reading</span>
                <span class="lnk-name">archive</span>
              </RouterLink>
              <a
                href="https://letterboxd.com/aidashpy/"
                target="_blank"
                rel="noopener noreferrer"
                class="lnk"
                @mousemove="handleTileMove"
                @mouseleave="handleTileLeave"
              >
                <span class="lnk-cat">film</span>
                <span class="lnk-name">letterboxd</span>
              </a>
              <a
                href="https://anilist.co/user/Aidashpy/"
                target="_blank"
                rel="noopener noreferrer"
                class="lnk"
                @mousemove="handleTileMove"
                @mouseleave="handleTileLeave"
              >
                <span class="lnk-cat">anime</span>
                <span class="lnk-name">anilist</span>
              </a>
            </div>
          </nav>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Page shell ─────────────────────────────────────────── */
.page {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1f1f21;
  padding: 1.5rem 1rem;
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
  opacity: 0.055;
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
  animation: starSpin 1.2s cubic-bezier(.2,.9,.25,1) both;
  transform-origin: center;
}

@keyframes starSpin {
  0%   { transform: rotate(-90deg) scale(0.6); opacity: 0; filter: blur(0.5px); }
  40%  { transform: rotate(20deg) scale(1.15); opacity: 1; filter: blur(0); }
  70%  { transform: rotate(-6deg) scale(1.05); opacity: 0.9; }
  100% { transform: rotate(-6deg) scale(1.05); opacity: 0; }
}

/* ── Wrap / transition ──────────────────────────────────── */
.wrap { width: 100%; max-width: 540px; }
@media (min-width: 768px)  { .wrap { max-width: 680px; } }
@media (min-width: 1280px) { .wrap { max-width: 820px; } }

.fade-enter-active { transition: opacity 300ms ease; }
.fade-enter-from   { opacity: 0; }

/* ── Card ───────────────────────────────────────────────── */
.card {
  background: #1a1a1c;
  border: 1px solid #2a2a2e;
  border-radius: 18px;
  padding: 2rem 2rem 1.75rem;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  transition: opacity 500ms, transform 300ms ease, box-shadow 300ms ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 56px rgba(0,0,0,0.68);
}
@media (min-width: 768px)  { .card { padding: 2.5rem 2.5rem 2.25rem; } }
@media (min-width: 1280px) { .card { padding: 3rem 3rem 2.75rem; border-radius: 22px; } }

.card-hidden {
  opacity: 0;
  transform: scale(0.93) rotate(4deg);
}

/* ── Card header ────────────────────────────────────────── */
.c-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.c-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #dcd5c0;
  letter-spacing: 0.06em;
  margin: 0;
}
@media (min-width: 768px)  { .c-title { font-size: 1.6rem; } }
@media (min-width: 1280px) { .c-title { font-size: 1.9rem; } }

.c-star {
  display: inline-block;
  color: #c2201f;
  font-size: 1rem;
  line-height: 1;
  opacity: 0.8;
  animation: starSpin 10s linear infinite;
}

@keyframes starSpin {
  to { transform: rotate(360deg); }
}

.c-rule {
  height: 1px;
  background: linear-gradient(to right, rgba(194,32,31,0.5), rgba(194,32,31,0.05));
  margin-bottom: 1.5rem;
  border-radius: 1px;
}

/* ── Painting ───────────────────────────────────────────── */
.painting-wrap {
  display: block;
  text-decoration: none;
  margin-bottom: 1.5rem;
}

.painting { margin: 0; }

.painting-img {
  width: 100%;
  display: block;
  border-radius: 8px;
  object-fit: contain;
  max-height: 42vh;
}
@media (min-width: 768px)  { .painting-img { max-height: 52vh; } }
@media (min-width: 1280px) { .painting-img { max-height: 58vh; } }

.painting-cap {
  display: flex;
  gap: 0.45rem;
  justify-content: center;
  margin-top: 0.55rem;
  font-size: 0.64rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #44424a;
}

.cap-dot { color: #c2201f; opacity: 0.4; }

/* ── Currently reading module ───────────────────────────── */
.reading-module {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.7rem 0.75rem;
  margin-bottom: 1.25rem;
  border: 1px solid #26262a;
  border-radius: 10px;
  text-decoration: none;
  position: relative;
  transition: border-color 120ms, background 120ms;
}
.reading-module:hover {
  border-color: rgba(194,32,31,0.35);
  background: rgba(194,32,31,0.04);
}

.rm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rm-label {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #c2201f;
  opacity: 0.7;
}
.rm-count {
  font-size: 0.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #3a3840;
}
.rm-books {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.rm-book {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.rm-thumb {
  width: 26px;
  height: 38px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  opacity: 0.85;
}
.rm-thumb-empty {
  width: 26px;
  height: 38px;
  border-radius: 3px;
  flex-shrink: 0;
  background: #26262a;
}
.rm-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}
.rm-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #a8a298;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rm-author {
  font-size: 0.68rem;
  color: #504e58;
}
.rm-arrow {
  position: absolute;
  bottom: 0.7rem;
  right: 0.75rem;
  font-size: 0.75rem;
  color: #3a3840;
  transition: color 120ms, transform 120ms;
}
.reading-module:hover .rm-arrow {
  color: rgba(194,32,31,0.5);
  transform: translateX(2px);
}

/* ── Recently read strip ────────────────────────────────── */
.recent-strip {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  margin-bottom: 1.25rem;
  border: 1px solid #26262a;
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 120ms, background 120ms;
}

.recent-strip:hover {
  border-color: rgba(194,32,31,0.35);
  background: rgba(194,32,31,0.04);
}

.recent-thumb {
  width: 32px;
  height: 44px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  opacity: 0.85;
}

.recent-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.recent-label {
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #c2201f;
  opacity: 0.7;
}

.recent-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #a8a298;
  white-space: normal;
  line-height: 1.3;
}
@media (min-width: 640px) {
  .recent-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.recent-author {
  font-size: 0.68rem;
  color: #504e58;
}

.recent-arrow {
  font-size: 0.75rem;
  color: #3a3840;
  flex-shrink: 0;
  transition: color 120ms, transform 120ms;
}

.recent-strip:hover .recent-arrow {
  color: rgba(194,32,31,0.5);
  transform: translateX(2px);
}

.strip-fade-enter-active { transition: opacity 400ms ease, transform 400ms ease; }
.strip-fade-enter-from   { opacity: 0; transform: translateY(6px); }

/* ── Links ──────────────────────────────────────────────── */
.links {
  border-top: 1px solid #26262a;
  padding-top: 1.2rem;
}

.links-label {
  font-size: 0.59rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #36363c;
  margin-bottom: 0.6rem;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.lnk {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #28282c;
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 120ms, background 120ms;
  will-change: transform;
}

.lnk:hover {
  border-color: rgba(194,32,31,0.55);
  background: rgba(194,32,31,0.06);
}

.lnk-cat {
  font-size: 0.57rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c2201f;
}

.lnk-name {
  font-size: 0.82rem;
  font-weight: 500;
  color: #a8a298;
}
</style>
