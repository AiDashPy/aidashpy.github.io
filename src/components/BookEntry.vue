<script setup>
import { ref, reactive, computed, watch, onUnmounted } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import { playTypeChar, playFlip } from "../composables/useAudio";

const _bioCache = new Map();

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

// Lift extracted color to minimum HSL lightness so dark covers stay legible on #16140d
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

const openBook = () => {
  const q = encodeURIComponent(`${props.book.name || ''} ${props.book.author || ''}`.trim());
  window.open(`https://openlibrary.org/search?q=${q}`, '_blank', 'noopener,noreferrer');
};

// ── Detail flip panel ────────────────────────────────────
const showDetail = ref(false);
const flipped = ref(false);
const bio = ref(null);
const bioSource = ref(null);
const bioLoading = ref(false);
let flipTimer = null;
let closeTimer = null;

// ── Typewriter ───────────────────────────────────────────
const tw         = reactive({ title: '', author: '', finish: '', bio: '', note: '' });
const twActive   = ref('');
const twDone     = reactive({ header: false, bio: false, all: false });
const typedTags  = ref([]);
const activeTagIdx = ref(-1);
const bioEl      = ref(null);
let typeTimer    = null;
let bioReadyStop = null;

function cMs(text, min, max, target) {
  return Math.max(min, Math.min(max, target / (text.length || 1)));
}

function isHanzi(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF) || (c >= 0xF900 && c <= 0xFAFF);
}
function randHanzi() {
  return String.fromCharCode(0x4E00 + Math.floor(Math.random() * (0x9FFF - 0x4E00 + 1)));
}

function typeField(field, text, ms, cb, hanziPasses = 3, hanziMs = 38, overflowCheck = null) {
  if (!text) { cb(); return; }
  twActive.value = field;
  let i = 0;

  function snap() { tw[field] = text; twActive.value = ''; cb(); }

  function step() {
    if (overflowCheck?.()) { snap(); return; }
    i++;
    const char = text[i - 1];
    const prefix = text.slice(0, i - 1);
    if (isHanzi(char) && hanziPasses > 0) {
      let n = hanziPasses;
      function scramble() {
        if (overflowCheck?.()) { snap(); return; }
        tw[field] = prefix + randHanzi();
        playTypeChar();
        if (--n > 0) { typeTimer = setTimeout(scramble, hanziMs); }
        else {
          tw[field] = text.slice(0, i);
          playTypeChar();
          if (i < text.length) typeTimer = setTimeout(step, ms);
          else { twActive.value = ''; cb(); }
        }
      }
      scramble();
    } else {
      tw[field] = text.slice(0, i);
      playTypeChar();
      if (i < text.length) typeTimer = setTimeout(step, ms);
      else { twActive.value = ''; cb(); }
    }
  }
  step();
}

function gap(ms, cb) { typeTimer = setTimeout(cb, ms); }

function startTypewriter() {
  clearTimeout(typeTimer);
  bioReadyStop?.(); bioReadyStop = null;
  Object.assign(tw, { title: '', author: '', finish: '', bio: '', note: '' });
  twActive.value = '';
  twDone.header = false; twDone.bio = false; twDone.all = false;
  typedTags.value = []; activeTagIdx.value = -1;

  const title  = props.book.name   || '';
  const author = props.book.author || '';
  const finish = shortFinish.value || '';
  const tags   = props.book.tags   || [];
  const note   = props.book.note   ? `"${props.book.note}"` : '';
  function afterNote() { twDone.all = true; }

  function afterTags() {
    if (note) gap(70, () => typeField('note', note, cMs(note, 18, 32, 700), afterNote));
    else afterNote();
  }

  function typeTags() {
    if (!tags.length) { afterTags(); return; }
    typedTags.value = new Array(tags.length).fill('');
    let ti = 0;
    function nextTag() {
      if (ti >= tags.length) { activeTagIdx.value = -1; twActive.value = ''; afterTags(); return; }
      activeTagIdx.value = ti;
      twActive.value = 'tag';
      const tag = tags[ti];
      const ms = cMs(tag, 14, 28, 380);
      let ci = 0;
      function step() {
        typedTags.value[ti] = tag.slice(0, ++ci);
        if (ci < tag.length) typeTimer = setTimeout(step, ms);
        else { ti++; gap(40, nextTag); }
      }
      step();
    }
    nextTag();
  }

  function afterBio() { twDone.bio = true; gap(80, typeTags); }

  function startBio() {
    if (bio.value) {
      const zh = hasChinese(bio.value);
      const bioMs = zh ? cMs(bio.value, 12, 25, 5000) : cMs(bio.value, 5, 12, 1800);
      const overflowCheck = () => { const el = bioEl.value; return el ? el.scrollHeight > el.clientHeight + 1 : false; };
      typeField('bio', bio.value, bioMs, afterBio, zh ? 1 : 3, zh ? 28 : 38, overflowCheck);
    } else { twDone.bio = true; typeTags(); }
  }

  function afterHeader() {
    twDone.header = true;
    gap(100, () => {
      if (bioLoading.value) {
        bioReadyStop = watch(bioLoading, loading => {
          if (!loading) { bioReadyStop?.(); bioReadyStop = null; startBio(); }
        });
      } else {
        startBio();
      }
    });
  }

  typeField('title', title, cMs(title, 20, 42, 1000), () =>
    gap(55, () => typeField('author', author, cMs(author, 18, 35, 700), () =>
      gap(50, () => typeField('finish', finish, cMs(finish, 16, 28, 480), () =>
        gap(50, afterHeader)
      ))
    ))
  );
}

function stopTypewriter() {
  clearTimeout(typeTimer); typeTimer = null;
  bioReadyStop?.(); bioReadyStop = null;
  Object.assign(tw, { title: '', author: '', finish: '', bio: '', note: '' });
  twActive.value = '';
  twDone.header = false; twDone.bio = false; twDone.all = false;
  typedTags.value = []; activeTagIdx.value = -1;
}

watch(flipped, (v) => { if (v) startTypewriter(); else stopTypewriter(); });

async function fetchFromOL() {
  const params = `title=${encodeURIComponent(props.book.name)}&author=${encodeURIComponent(props.book.author)}&fields=key&limit=1`;
  const search = await fetch(`https://openlibrary.org/search.json?${params}`).then(r => r.json());
  const workKey = search.docs?.[0]?.key;
  if (!workKey) return null;
  const work = await fetch(`https://openlibrary.org${workKey}.json`).then(r => r.json());
  const raw = typeof work.description === 'string' ? work.description : work.description?.value ?? null;
  if (!raw) return null;
  return { text: raw.replace(/<[^>]+>/g, '').trim(), url: `https://openlibrary.org${workKey}`, label: 'Open Library' };
}

async function fetchFromWikipedia() {
  const q = `${props.book.name} ${props.book.author}`;
  const searchRes = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json&origin=*&srnamespace=0`
  ).then(r => r.json());
  const pageTitle = searchRes.query?.search?.[0]?.title;
  if (!pageTitle) return null;
  const summary = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
  ).then(r => r.json());
  if (!summary.extract) return null;
  const url = summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
  return { text: summary.extract, url, label: 'Wikipedia' };
}

async function fetchFromGoogleBooks() {
  const key = import.meta.env.VITE_BOOKS_API_KEY;
  const q = `intitle:${encodeURIComponent(props.book.name)}+inauthor:${encodeURIComponent(props.book.author)}`;
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo(description,infoLink))${key ? `&key=${key}` : ''}`
  ).then(r => r.json());
  const item = res.items?.[0];
  const description = item?.volumeInfo?.description;
  if (!description) return null;
  const url = item?.volumeInfo?.infoLink ?? `https://books.google.com/books?q=${encodeURIComponent(props.book.name)}`;
  return { text: description.replace(/<[^>]+>/g, '').trim(), url, label: 'Google Books' };
}

async function fetchFromZhWikipedia() {
  const q = `${props.book.name} ${props.book.author}`;
  const searchRes = await fetch(
    `https://zh.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=1&format=json&origin=*&srnamespace=0`
  ).then(r => r.json());
  const pageTitle = searchRes.query?.search?.[0]?.title;
  if (!pageTitle) return null;
  const summary = await fetch(
    `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`
  ).then(r => r.json());
  if (!summary.extract) return null;
  const url = summary.content_urls?.desktop?.page ?? `https://zh.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
  return { text: summary.extract, url, label: '维基百科' };
}

function hasChinese(text) {
  return /[一-鿿㐀-䶿豈-﫿]/.test(text);
}

async function fetchBio() {
  const key = `${props.book.name}|${props.book.author}`;
  if (_bioCache.has(key)) {
    const cached = _bioCache.get(key);
    bio.value = cached?.text ?? null;
    bioSource.value = cached ?? null;
    return;
  }
  bioLoading.value = true;
  try {
    let result = null;
    if (hasChinese(props.book.name)) {
      try { result = await fetchFromZhWikipedia(); } catch {}
      if (!result) try { result = await fetchFromOL(); } catch {}
      if (!result) try { result = await fetchFromGoogleBooks(); } catch {}
      if (!result) result = await fetchFromWikipedia();
    } else {
      try { result = await fetchFromOL(); } catch {}
      if (!result) try { result = await fetchFromGoogleBooks(); } catch {}
      if (!result) result = await fetchFromWikipedia();
    }
    bio.value = result?.text ?? null;
    bioSource.value = result;
    _bioCache.set(key, result);
  } catch {
    bio.value = null;
    bioSource.value = null;
    _bioCache.set(key, null);
  } finally {
    bioLoading.value = false;
  }
}

function openDetail() {
  clearTimeout(closeTimer);
  showDetail.value = true;
  flipped.value = false;
  playFlip();
  flipTimer = setTimeout(() => { flipped.value = true; }, 320);
  fetchBio();
}

function closeDetail() {
  clearTimeout(flipTimer);
  flipped.value = false;
  closeTimer = setTimeout(() => { showDetail.value = false; }, 480);
}

function onDetailKey(e) { if (e.key === 'Escape') closeDetail(); }

watch(showDetail, open => {
  if (open) {
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onDetailKey);
  } else {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onDetailKey);
  }
});

onUnmounted(() => {
  clearTimeout(flipTimer);
  clearTimeout(closeTimer);
  clearTimeout(typeTimer);
  bioReadyStop?.();
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onDetailKey);
});

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

// Scroll-reveal via IntersectionObserver
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

  <!-- ── Detail flip overlay ──────────────────────────── -->
  <Teleport to="body">
    <Transition name="do">
      <div v-if="showDetail" class="detail-overlay" @click.self="closeDetail">
        <div class="flip-scene">
          <div class="flip-card" :class="{ 'flip-card-flipped': flipped }" role="dialog" :aria-label="book.name">

            <!-- Front: cover image -->
            <div class="flip-front" aria-hidden="true">
              <img v-if="book.img" :src="book.img" class="flip-bg-img" aria-hidden="true" />
              <img v-if="book.img" :src="book.img" :alt="book.name" class="flip-cover-img" />
            </div>

            <!-- Back: detail -->
            <div class="flip-back">
              <button class="detail-close" @click="closeDetail" aria-label="Close">×</button>

              <div class="detail-head">
                <img v-if="book.img" :src="book.img" :alt="book.name" class="detail-thumb" />
                <div class="detail-head-text">
                  <h2 class="detail-title">{{ tw.title }}<span v-if="twActive === 'title'" class="tw-cur" aria-hidden="true"></span></h2>
                  <p class="detail-author">{{ tw.author }}<span v-if="twActive === 'author'" class="tw-cur" aria-hidden="true"></span></p>
                  <div class="detail-meta-row">
                    <span class="detail-finish" :class="{ 'detail-finish-ip': inProgress }">{{ tw.finish }}<span v-if="twActive === 'finish'" class="tw-cur" aria-hidden="true"></span></span>
                  </div>
                </div>
              </div>

              <div class="detail-rule"></div>

              <div class="detail-bio-wrap">
                <p v-if="bioLoading && twDone.header" class="detail-bio-loading">loading…</p>
                <template v-else-if="bio">
                  <p ref="bioEl" class="detail-bio">{{ tw.bio }}<span v-if="twActive === 'bio'" class="tw-cur" aria-hidden="true"></span></p>
                  <a v-if="bioSource && twDone.bio" :href="bioSource.url" target="_blank" rel="noopener noreferrer" class="bio-source-link">via {{ bioSource.label }} &rarr;</a>
                </template>
                <p v-else-if="twDone.header && !bioLoading" class="detail-bio-empty">No synopsis available.</p>
              </div>

              <div v-if="typedTags.length" class="detail-tags">
                <span v-for="(t, i) in typedTags" :key="i" class="tag">{{ t }}<span v-if="twActive === 'tag' && activeTagIdx === i" class="tw-cur tw-cur-sm" aria-hidden="true"></span></span>
              </div>

              <p v-if="tw.note" class="detail-note">{{ tw.note }}<span v-if="twActive === 'note'" class="tw-cur" aria-hidden="true"></span></p>

              <button class="detail-open-btn" @click="openBook">Open Library &rarr;</button>
            </div>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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

/* ── Detail flip overlay ────────────────────────────────── */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(10, 9, 5, 0.88);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.flip-scene {
  perspective: 1000px;
  width: min(380px, calc(100vw - 2rem));
  height: min(540px, calc(100dvh - 4rem));
}

.flip-card {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 520ms cubic-bezier(0.4, 0, 0.2, 1);
}
.flip-card-flipped { transform: rotateY(180deg); }

.flip-front,
.flip-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 14px;
  overflow: hidden;
}

/* Front: full-bleed cover with blurred bg */
.flip-front {
  background: #0e0d08;
}
.flip-bg-img {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  object-fit: cover;
  filter: blur(28px) saturate(0.7) brightness(0.4);
}
.flip-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* Back: detail card */
.flip-back {
  transform: rotateY(180deg);
  background: #1a1812;
  border: 1px solid #2a2618;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  overflow-y: auto;
}

.detail-close {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid #2a2618;
  border-radius: 7px;
  color: #5a5440;
  font-size: 1.1rem;
  cursor: pointer;
  transition: color 130ms, border-color 130ms;
  flex-shrink: 0;
}
.detail-close:hover { color: #9a8c6c; border-color: #3a3620; }

.detail-head {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
  padding-right: 2rem;
  margin-top: 0.25rem;
}

.detail-thumb {
  width: 56px;
  height: 84px;
  object-fit: contain;
  border-radius: 4px;
  background: #131108;
  flex-shrink: 0;
}

.detail-head-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.detail-title {
  font-size: 1rem;
  font-weight: 700;
  color: #e0d4b4;
  line-height: 1.3;
  margin: 0;
}

.detail-author {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--accent, #728a50);
  margin: 0;
}

.detail-meta-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 2px;
}

.detail-finish {
  font-size: 0.68rem;
  font-weight: 600;
  color: #a87e3c;
}
.detail-finish-ip { color: #7a8c58; }

.detail-rule {
  height: 1px;
  background: #252110;
  flex-shrink: 0;
}

.detail-bio-wrap { flex: 1; min-height: 0; }

.detail-bio {
  font-size: 0.775rem;
  line-height: 1.65;
  color: #6a6248;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-bio-loading {
  font-size: 0.72rem;
  color: #3c3924;
  margin: 0;
  animation: bio-pulse 1.4s ease-in-out infinite;
}
@keyframes bio-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}

.detail-bio-empty {
  font-size: 0.72rem;
  color: #3c3924;
  margin: 0;
  font-style: italic;
}

.bio-source-link {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.65rem;
  font-weight: 600;
  color: #3c3924;
  text-decoration: none;
  letter-spacing: 0.04em;
  transition: color 130ms;
}
.bio-source-link:hover { color: #7a8c58; }

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-note {
  font-size: 0.72rem;
  color: #524e3c;
  line-height: 1.55;
  margin: 0;
  font-style: italic;
}

.detail-open-btn {
  margin-top: auto;
  padding: 0.6rem 1rem;
  background: #1c2010;
  border: 1px solid #2a3018;
  border-radius: 8px;
  color: #7a8c58;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 140ms, border-color 140ms, color 140ms;
  text-align: center;
  flex-shrink: 0;
}
.detail-open-btn:hover { background: #222e12; border-color: #3a4820; color: #9aac70; }

/* ── Typewriter cursor ──────────────────────────────────── */
.tw-cur {
  display: inline-block;
  width: 1.5px;
  height: 0.82em;
  background: currentColor;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: tw-blink 900ms step-end infinite;
}
.tw-cur-sm { height: 0.7em; width: 1px; }
@keyframes tw-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Overlay transition ─────────────────────────────────── */
.do-enter-active { transition: opacity 200ms ease; }
.do-leave-active { transition: opacity 180ms ease; }
.do-enter-from, .do-leave-to { opacity: 0; }
</style>
