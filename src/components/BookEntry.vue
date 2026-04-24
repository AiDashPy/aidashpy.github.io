<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  book: { type: Object, required: true },
  index: { type: Number, default: 0 },
  priority: { type: Boolean, default: false }
});

const placeholderSvg = `data:image/svg+xml;utf8,` + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='120' viewBox='0 0 80 120'>
    <rect width='100%' height='100%' fill='#1a1812'/>
  </svg>`
);

const imgLoaded = ref(false);
function onImgLoad() { imgLoaded.value = true; }
function onImgError(e) {
  const img = e?.target;
  if (!img || img.dataset._p) return;
  img.src = placeholderSvg; img.dataset._p = '1';
  imgLoaded.value = true;
}

const openGoodreads = () => {
  const q = encodeURIComponent(`${props.book.name || ''} ${props.book.author || ''}`.trim());
  window.open(`https://www.goodreads.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
};

const shortFinish = computed(() => {
  const f = props.book.finish;
  if (!f) return '';
  const isStarted = /^started/i.test(f);
  const date = f.replace(/^(?:Finished|Started)\s*/i, '');
  return isStarted ? `in progress` : date;
});

const indexLabel = computed(() => String(props.index).padStart(2, '0'));
</script>

<template>
  <li class="row" :style="{ '--i': index - 1 }">
    <div class="row-inner">

      <!-- Index -->
      <span class="idx" aria-hidden="true">{{ indexLabel }}</span>

      <!-- Cover -->
      <button class="cover" @click="openGoodreads" :title="`Search ${book.name} on Goodreads`" aria-label="Search on Goodreads">
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
      </div>

      <!-- Meta -->
      <div class="meta">
        <span class="finish">{{ shortFinish }}</span>
        <span v-if="book.pages" class="pages">{{ book.pages }}&thinsp;p</span>
      </div>

    </div>
  </li>
</template>

<style scoped>
/* ── Row ───────────────────────────────────────────────── */
.row {
  border-bottom: 1px solid #211f15;
  animation: row-in 320ms ease both;
  animation-delay: calc(var(--i, 0) * 35ms);
}
.row:last-child { border-bottom: none; }

@keyframes row-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.row-inner {
  display: grid;
  grid-template-columns: 2rem 68px 1fr;
  grid-template-areas: "idx cover text";
  gap: 1rem;
  align-items: start;
  padding: 1.25rem 0.5rem;
  border-radius: 8px;
  transition: background 150ms ease;
  margin: 0 -0.5rem;
}
.row:hover .row-inner { background: rgba(255, 245, 215, 0.028); }

@media (min-width: 640px) {
  .row-inner {
    grid-template-columns: 2rem 76px 1fr auto;
    grid-template-areas: "idx cover text meta";
  }
}

/* ── Index ─────────────────────────────────────────────── */
.idx {
  grid-area: idx;
  font-size: 0.7rem;
  font-weight: 700;
  color: #302e1e;
  letter-spacing: 0.06em;
  padding-top: 3px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  user-select: none;
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
  color: #728a50;
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

/* ── Meta ──────────────────────────────────────────────── */
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

/* Mobile: meta appended inside text col */
@media (max-width: 639px) {
  .text::after {
    content: attr(data-finish);
  }
}

.finish {
  font-size: 0.72rem;
  font-weight: 600;
  color: #a87e3c;
  white-space: nowrap;
}

.pages {
  font-size: 0.68rem;
  color: #40392a;
  font-variant-numeric: tabular-nums;
}
</style>
