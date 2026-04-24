<script setup>
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";
import { yearlyBookEntries } from "../javascript/yearlyBookData";

const created = ref(false);
const showOverlay = ref(true);
const cardRef = ref(null);
const cardStyle = ref({});

let currentTiltX = 0;
let currentTiltY = 0;
let currentTx = 0;
let currentTy = 0;
let justEntered = false;

const MAX_TILT = 1.5;
const MAX_TRANSLATE = 6;

function applyCardStyle(smooth = false) {
  const mag = Math.min(1, Math.hypot(currentTiltX, currentTiltY) / (MAX_TILT * 0.6));
  cardStyle.value = {
    transform: `perspective(1000px) translate3d(${currentTx}px, ${currentTy}px, 0) rotateX(${currentTiltX}deg) rotateY(${currentTiltY}deg) scale(${1 + 0.01 * mag})`,
    willChange: "transform",
    transition: smooth ? "transform 820ms cubic-bezier(.22,1,.36,1)" : "none",
  };
}

function handleMouseMove(e) {
  const el = cardRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
  const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

  currentTiltY = -nx * MAX_TILT;
  currentTiltX = -ny * MAX_TILT;
  currentTx = nx * MAX_TRANSLATE;
  currentTy = -ny * MAX_TRANSLATE;

  applyCardStyle(justEntered);
  justEntered = false;
}

function handleMouseEnter() { justEntered = true; }

function handleMouseLeave() {
  currentTiltX = currentTiltY = currentTx = currentTy = 0;
  cardStyle.value = {
    transform: "perspective(1000px) translate3d(0,0,0) rotateX(0deg) rotateY(0deg) scale(1)",
    willChange: "transform",
    transition: "transform 820ms cubic-bezier(.22,1,.36,1)",
  };
}

function onOverlayEnd() { showOverlay.value = false; }

onMounted(() => {
  created.value = true;
  setTimeout(() => { showOverlay.value = false; }, 1400);

  try {
    yearlyBookEntries.forEach((year) =>
      (year.entries || []).forEach((e) => { if (e?.img) new Image().src = e.img; })
    );
    new Image().src = "/images/ThePaintingNewPlanetNew.webp";
  } catch {}

  cardStyle.value = {
    transform: "none",
    willChange: "transform",
    transition: "transform 820ms cubic-bezier(.22,1,.36,1)",
  };
});
</script>

<template>
  <div class="page">
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
          ref="cardRef"
          class="card"
          :class="showOverlay ? 'card-hidden' : ''"
          :style="cardStyle"
          @mouseenter="handleMouseEnter"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
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

          <nav class="links">
            <div class="links-label">links</div>
            <div class="links-grid">
              <RouterLink to="/" class="lnk">
                <span class="lnk-cat">reading</span>
                <span class="lnk-name">archive</span>
              </RouterLink>
              <a href="https://letterboxd.com/aidashpy/" target="_blank" rel="noopener noreferrer" class="lnk">
                <span class="lnk-cat">film</span>
                <span class="lnk-name">letterboxd</span>
              </a>
              <a href="https://anilist.co/user/Aidashpy/" target="_blank" rel="noopener noreferrer" class="lnk">
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
  min-height: calc(100vh - 5rem);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1f1f21;
  padding: 1.5rem 1rem;
  box-sizing: border-box;
  overflow: hidden;
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
  overflow: auto;
  max-height: calc(100vh - 7rem);
  transition: opacity 500ms, transform 500ms;
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
  color: #c2201f;
  font-size: 1rem;
  line-height: 1;
  opacity: 0.8;
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
