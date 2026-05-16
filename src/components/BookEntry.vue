<script setup>
import { ref, computed } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import BookDetail from "./BookDetail.vue";

const props = defineProps({
  book: { type: Object, required: true },
  index: { type: Number, default: 0 },
  priority: { type: Boolean, default: false },
  inProgress: { type: Boolean, default: false },
});

function dominantColor(img) {
  try {
    const size = 24;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    c.getContext("2d").drawImage(img, 0, 0, size, size);
    const d = c.getContext("2d").getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const sat = Math.max(d[i], d[i+1], d[i+2]) - Math.min(d[i], d[i+1], d[i+2]);
      const w = 1 + sat / 128;
      r += d[i] * w; g += d[i+1] * w; b += d[i+2] * w; n += w;
    }
    if (!n) return null;
    return `${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)}`;
  } catch { return null; }
}

function liftRgb(rgb, minL = 0.48) {
  const [r, g, b] = rgb.split(',').map(Number);
  const rn = r/255, gn = g/255, bn = b/255;
  const max = Math.max(rn,gn,bn), min = Math.min(rn,gn,bn);
  let l = (max + min) / 2;
  if (l >= minL) return rgb;
  const d = max - min;
  const s = d === 0 ? 0 : (l > 0.5 ? d / (2 - max - min) : d / (max + min));
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn-bn)/d + (gn<bn?6:0)) / 6;
    else if (max === gn) h = ((bn-rn)/d + 2) / 6;
    else h = ((rn-gn)/d + 4) / 6;
  }
  l = minL;
  if (s === 0) { const v = Math.round(l*255); return `${v},${v},${v}`; }
  const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const hue2rgb = (p,q,t) => { t=((t%1)+1)%1; if(t<1/6)return p+(q-p)*6*t; if(t<0.5)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
  return [hue2rgb(p,q,h+1/3), hue2rgb(p,q,h), hue2rgb(p,q,h-1/3)].map(v=>Math.round(v*255)).join(',');
}

const accentRgb = ref(null);
const accentVivid = computed(() => accentRgb.value ? liftRgb(accentRgb.value) : null);
const accentColor = computed(() => accentVivid.value ? `rgb(${accentVivid.value})` : null);
const accentDim   = computed(() => accentVivid.value ? `rgba(${accentVivid.value},0.18)` : null);
const accentGlow  = computed(() => accentVivid.value ? `rgba(${accentVivid.value},0.07)` : null);

const placeholderSvg = `data:image/svg+xml;utf8,` + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='120' viewBox='0 0 80 120'>
    <rect width='100%' height='100%' fill='#1a1812'/>
  </svg>`
);

const imgLoaded = ref(false);
function onImgLoad(e) {
  imgLoaded.value = true;
  const img = e?.target;
  if (!img || img.dataset._p) return;
  accentRgb.value = dominantColor(img);
}
function onImgError(e) {
  const img = e?.target;
  if (!img || img.dataset._p) return;
  img.src = placeholderSvg; img.dataset._p = '1';
  imgLoaded.value = true;
}

const bookDetailRef = ref(null);
function openDetail() { bookDetailRef.value?.open(); }

const shortFinish = computed(() => {
  const { finished, date, finish } = props.book;
  if (finished !== undefined) return finished ? (date || '') : 'in progress';
  if (finish) {
    const isStarted = /^started/i.test(finish);
    const d = finish.replace(/^(?:Finished|Started)\s*/i, '');
    return isStarted ? 'in progress' : d;
  }
  return '';
});

const indexLabel = computed(() => String(props.index).padStart(2, '0'));

const rowRef = ref(null);
const visible = ref(false);
useIntersectionObserver(rowRef, ([{ isIntersecting }]) => {
  if (isIntersecting) visible.value = true;
}, { threshold: 0.05 });
</script>

<template>
  <li
    ref="rowRef"
    class="row"
    :class="{ 'row-visible': visible, 'row-ip': inProgress }"
    :style="{ '--accent': accentColor, '--accent-dim': accentDim, '--accent-glow': accentGlow }"
  >
    <div class="row-inner">

      <!-- Index / now-reading dot -->
      <span v-if="inProgress" class="idx-dot" aria-hidden="true"></span>
      <span v-else class="idx" aria-hidden="true">{{ indexLabel }}</span>

      <!-- Cover -->
      <button class="cover" @click="openDetail" :title="`View details for ${book.name}`" aria-label="View book details">
        <div v-if="!imgLoaded" class="cover-bg"></div>
        <img
          :src="book.img"
          :alt="book.name"
          :loading="priority ? 'eager' : 'lazy'"
          decoding="async"
          width="80" height="120"
          class="cover-img"
          :class="imgLoaded ? 'img-in' : 'img-out'"
          @load="onImgLoad"
          crossorigin="anonymous"
          @error="onImgError"
        />
      </button>

      <!-- Text -->
      <div class="text">
        <h3 class="title">{{ book.name }}</h3>
        <p class="author">{{ book.author }}</p>

        <div v-if="book.tags?.length" class="tags">
          <span v-for="(t, i) in book.tags.slice(0, 4)" :key="i" class="tag">{{ t }}</span>
        </div>

        <p v-if="book.note" class="note">{{ book.note }}</p>

        <!-- Mobile-only finish date -->
        <div v-if="shortFinish" class="meta-m">
          <span class="finish" :class="{ 'finish-ip': inProgress }">{{ shortFinish }}</span>
        </div>
      </div>

      <!-- Meta (desktop) -->
      <div class="meta">
        <span class="finish" :class="{ 'finish-ip': inProgress }">{{ shortFinish }}</span>
      </div>

    </div>
  </li>

  <BookDetail ref="bookDetailRef" :book="book" :in-progress="inProgress" />
</template>

<style scoped>
/* ── Row ───────────────────────────────────────────────── */
.row {
  border-bottom: 1px solid var(--accent-dim, #211f15);
  opacity: 0;
  transform: translateY(10px);
  transition:
    opacity 340ms ease,
    transform 340ms ease,
    border-color 400ms ease;
  transition-delay: calc(var(--i, 0) * 28ms);
}
.row-visible {
  opacity: 1;
  transform: translateY(0);
}
.row:last-child { border-bottom: none; }

.row-inner {
  display: grid;
  grid-template-columns: 2rem 68px 1fr;
  grid-template-areas: "idx cover text";
  gap: 1rem;
  align-items: start;
  padding: 1.25rem 0.5rem;
  border-radius: 8px;
  transition: background 200ms ease;
  margin: 0 -0.5rem;
}
.row:hover .row-inner { background: var(--accent-glow, rgba(255, 245, 215, 0.028)); }

@media (min-width: 640px) {
  .row-inner {
    grid-template-columns: 2rem 76px 1fr auto;
    grid-template-areas: "idx cover text meta";
  }
}

/* ── In-progress row ───────────────────────────────────── */
.row-ip {
  border-left: 2px solid rgba(122, 140, 88, 0.35);
  margin-left: -2px;
}
.row-ip .row-inner { padding-left: calc(0.5rem + 2px); }

/* ── Index ─────────────────────────────────────────────── */
.idx {
  grid-area: idx;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--accent, #302e1e);
  letter-spacing: 0.06em;
  padding-top: 3px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  user-select: none;
  -webkit-text-stroke: 0.4px #16140d;
  text-shadow: 0 0 5px rgba(22, 20, 13, 0.9);
}

.idx-dot {
  grid-area: idx;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-top: 6px;
}
.idx-dot::after {
  content: '';
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7a8c58;
  flex-shrink: 0;
  animation: ip-pulse 2.4s ease-in-out infinite;
}
@keyframes ip-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(122, 140, 88, 0.5); }
  50%       { box-shadow: 0 0 0 4px rgba(122, 140, 88, 0); }
}

/* ── Cover ─────────────────────────────────────────────── */
.cover {
  grid-area: cover;
  position: relative;
  width: 68px;
  height: 100px;
  border-radius: 5px;
  overflow: hidden;
  background: #1a1812;
  border: none;
  padding: 0;
  cursor: pointer;
  display: block;
  flex-shrink: 0;
}
@media (min-width: 640px) { .cover { width: 76px; height: 112px; } }

.cover-bg { position: absolute; inset: 0; background: #1c1a12; }

.cover-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  transition: opacity 220ms ease, transform 300ms ease;
}
.img-out { opacity: 0; }
.img-in  { opacity: 1; }
.cover:hover .cover-img { transform: scale(1.06); }

/* ── Text ──────────────────────────────────────────────── */
.text {
  grid-area: text;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  color: #e0d4b4;
  margin: 0;
}
@media (min-width: 640px) { .title { font-size: 1.0625rem; } }

.author {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--accent, #728a50);
  margin: 0;
  letter-spacing: 0.01em;
}

.tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }

.tag {
  font-size: 9.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  background: #1c2010;
  color: #607840;
  border: 1px solid #2a3018;
  letter-spacing: 0.02em;
}

.note {
  font-size: 0.735rem;
  color: #524e3c;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 2px 0 0;
}

/* ── Meta (desktop column) ─────────────────────────────── */
.meta {
  grid-area: meta;
  display: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding-top: 2px;
  flex-shrink: 0;
}
@media (min-width: 640px) { .meta { display: flex; } }

/* ── Meta (mobile inline) ──────────────────────────────── */
.meta-m {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 3px;
}
@media (min-width: 640px) { .meta-m { display: none; } }

.finish {
  font-size: 0.72rem;
  font-weight: 600;
  color: #a87e3c;
  white-space: nowrap;
}
.finish-ip {
  color: #7a8c58;
}
</style>
