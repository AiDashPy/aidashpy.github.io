<script setup>
import { ref, reactive, computed, watch, onUnmounted } from "vue";
import { playTypeChar, playFlip } from "../composables/useAudio";
import { gsap } from "gsap";

const _bioCache = new Map();

const props = defineProps({
  book: { type: Object, required: true },
  inProgress: { type: Boolean, default: false },
  layoutMode: { type: String, default: 'poster' },
  index: { type: Number, default: 1 },
});

const emit = defineEmits(["close"]);

// ── Accent color ─────────────────────────────────────────
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
  const [r, g, b] = rgb.split(",").map(Number);
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
  return [hue2rgb(p,q,h+1/3), hue2rgb(p,q,h), hue2rgb(p,q,h-1/3)].map(v=>Math.round(v*255)).join(",");
}

// Per-character title display for the constructivist modal.
// Each character always occupies its final position (full title always in DOM),
// untyped chars are transparent so line-breaks are determined by the complete text.
const titleDisplayChars = computed(() => {
  const fullChars = Array.from(props.book.name || '');
  const typedLen  = tw.title.length;
  return fullChars.map((finalChar, i) => ({
    ch:    i < typedLen ? (tw.title[i] ?? finalChar) : finalChar,
    ghost: i >= typedLen,
  }));
});

const accentRgb = ref(null);
const accentVivid = computed(() => accentRgb.value ? liftRgb(accentRgb.value) : null);
const accentColor = computed(() => accentVivid.value ? `rgb(${accentVivid.value})` : null);
const auraStyle = computed(() =>
  accentVivid.value
    ? { background: `radial-gradient(ellipse at 50% 38%, rgba(${accentVivid.value}, 0.13) 0%, transparent 62%)` }
    : {}
);

function onCoverLoad(e) {
  const img = e?.target;
  if (!img) return;
  accentRgb.value = dominantColor(img);
}

// ── Typewriter ───────────────────────────────────────────
const tw         = reactive({ title: "", author: "", finish: "", pages: "", bio: "", note: "" });
const twActive   = ref("");
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
  function snap() { tw[field] = text; twActive.value = ""; cb(); }
  function step() {
    if (overflowCheck?.()) { snap(); return; }
    i++;
    const char = text[i - 1];
    const prefix = text.slice(0, i - 1);
    if (isHanzi(char) && hanziPasses > 0) {
      let n = hanziPasses;
      function scramble() {
        if (overflowCheck?.()) { snap(); return; }
        const hz = randHanzi();
        tw[field] = prefix + hz;
        playTypeChar(hz);
        if (--n > 0) { typeTimer = setTimeout(scramble, hanziMs); }
        else {
          tw[field] = text.slice(0, i);
          playTypeChar(char);
          if (i < text.length) typeTimer = setTimeout(step, ms);
          else { twActive.value = ""; cb(); }
        }
      }
      scramble();
    } else {
      tw[field] = text.slice(0, i);
      playTypeChar(char);
      if (i < text.length) typeTimer = setTimeout(step, ms);
      else { twActive.value = ""; cb(); }
    }
  }
  step();
}

function gap(ms, cb) { typeTimer = setTimeout(cb, ms); }

function startTypewriter() {
  clearTimeout(typeTimer);
  bioReadyStop?.(); bioReadyStop = null;
  Object.assign(tw, { title: "", author: "", finish: "", pages: "", bio: "", note: "" });
  twActive.value = "";
  twDone.header = false; twDone.bio = false; twDone.all = false;
  typedTags.value = []; activeTagIdx.value = -1;

  const title  = props.book.name   || "";
  const author = props.book.author || "";
  const finish = shortFinish.value || "";
  const tags   = props.book.tags   || [];
  const note   = props.book.note   ? `"${props.book.note}"` : "";

  function afterNote() { twDone.all = true; }

  function afterTags() {
    if (note) gap(70, () => typeField("note", note, cMs(note, 18, 32, 700), afterNote));
    else afterNote();
  }

  function typeTags() {
    if (!tags.length) { afterTags(); return; }
    typedTags.value = new Array(tags.length).fill("");
    let ti = 0;
    function nextTag() {
      if (ti >= tags.length) { activeTagIdx.value = -1; twActive.value = ""; afterTags(); return; }
      activeTagIdx.value = ti;
      twActive.value = "tag";
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
      typeField("bio", bio.value, bioMs, afterBio, zh ? 1 : 3, zh ? 28 : 38, overflowCheck);
    } else { twDone.bio = true; typeTags(); }
  }

  function typePages() {
    const pagesText = pageCount.value ? `${pageCount.value} pp` : null;
    if (pagesText) {
      typeField("pages", pagesText, cMs(pagesText, 25, 45, 300), () => gap(40, startBio));
    } else {
      startBio();
    }
  }

  function afterHeader() {
    twDone.header = true;
    gap(100, () => {
      if (bioLoading.value) {
        bioReadyStop = watch(bioLoading, loading => {
          if (!loading) { bioReadyStop?.(); bioReadyStop = null; typePages(); }
        });
      } else {
        typePages();
      }
    });
  }

  typeField("title", title, cMs(title, 20, 42, 1000), () =>
    gap(55, () => typeField("author", author, cMs(author, 18, 35, 700), () =>
      gap(50, () => typeField("finish", finish, cMs(finish, 16, 28, 480), () =>
        gap(50, afterHeader)
      ))
    ))
  );
}

function stopTypewriter() {
  clearTimeout(typeTimer); typeTimer = null;
  bioReadyStop?.(); bioReadyStop = null;
  Object.assign(tw, { title: "", author: "", finish: "", pages: "", bio: "", note: "" });
  twActive.value = "";
  twDone.header = false; twDone.bio = false; twDone.all = false;
  typedTags.value = []; activeTagIdx.value = -1;
}

function snapTypewriter() {
  clearTimeout(typeTimer); typeTimer = null;
  bioReadyStop?.(); bioReadyStop = null;
  tw.title  = props.book.name   || "";
  tw.author = props.book.author || "";
  tw.finish = shortFinish.value || "";
  tw.pages  = pageCount.value   ? `${pageCount.value} pp` : "";
  tw.bio    = bio.value         || "";
  tw.note   = props.book.note ? `"${props.book.note}"` : "";
  twActive.value = "";
  twDone.header = true; twDone.bio = true; twDone.all = true;
  typedTags.value = [...(props.book.tags || [])];
  activeTagIdx.value = -1;
}

// ── Bio fetching ─────────────────────────────────────────
const bio        = ref(null);
const bioSource  = ref(null);
const bioLoading = ref(false);
const pageCount  = computed(() => bioSource.value?.pageCount ?? null);

async function fetchFromOL() {
  const params = `title=${encodeURIComponent(props.book.name)}&author=${encodeURIComponent(props.book.author)}&fields=key&limit=1`;
  const search = await fetch(`https://openlibrary.org/search.json?${params}`).then(r => r.json());
  const workKey = search.docs?.[0]?.key;
  if (!workKey) return null;
  const work = await fetch(`https://openlibrary.org${workKey}.json`).then(r => r.json());
  const raw = typeof work.description === "string" ? work.description : work.description?.value ?? null;
  if (!raw) return null;
  return { text: raw.replace(/<[^>]+>/g, "").trim(), url: `https://openlibrary.org${workKey}`, label: "Open Library" };
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
  return { text: summary.extract, url, label: "Wikipedia" };
}

async function fetchFromGoogleBooks() {
  const key = import.meta.env.VITE_BOOKS_API_KEY;
  const q = `intitle:${encodeURIComponent(props.book.name)}+inauthor:${encodeURIComponent(props.book.author)}`;
  const r = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1&fields=items(volumeInfo(description,infoLink,pageCount))${key ? `&key=${key}` : ""}`
  );
  if (!r.ok) return null;
  const res = await r.json();
  const item = res.items?.[0];
  const description = item?.volumeInfo?.description;
  if (!description) return null;
  const url = item?.volumeInfo?.infoLink ?? `https://books.google.com/books?q=${encodeURIComponent(props.book.name)}`;
  return { text: description.replace(/<[^>]+>/g, "").trim(), url, label: "Google Books", pageCount: item?.volumeInfo?.pageCount ?? null };
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
  return { text: summary.extract, url, label: "维基百科" };
}

function hasChinese(text) {
  return /[一-鿿㐀-䶿豈-﫿]/.test(text);
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
      try { result = await fetchFromGoogleBooks(); } catch {}
      if (!result) try { result = await fetchFromZhWikipedia(); } catch {}
      if (!result) try { result = await fetchFromOL(); } catch {}
      if (!result) result = await fetchFromWikipedia();
    } else {
      try { result = await fetchFromGoogleBooks(); } catch {}
      if (!result) try { result = await fetchFromOL(); } catch {}
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

// ── Detail flip panel ────────────────────────────────────
const showDetail = ref(false);
const flipped = ref(false);
const viewingCover = ref(false);
let flipTimer = null;
let closeTimer = null;

function openDetail() {
  clearTimeout(closeTimer);
  showDetail.value = true;
  flipped.value = false;
  viewingCover.value = false;
  stopTypewriter();
  if (props.layoutMode === 'constructivist') {
    startTypewriter();
  } else {
    playFlip();
    flipTimer = setTimeout(() => {
      flipped.value = true;
      startTypewriter();
    }, 320);
  }
  fetchBio();
}

function closeDetail() {
  clearTimeout(flipTimer);
  if (props.layoutMode === 'constructivist') {
    viewingCover.value = false;
    showDetail.value = false;
    // stopTypewriter() + emit('close') fire in cOnLeave after animation
    return;
  }
  stopTypewriter();
  const wasPeeking = viewingCover.value;
  viewingCover.value = false;
  flipped.value = false;
  if (wasPeeking) {
    // already on front face — just fade the overlay out, no flip wait
    showDetail.value = false;
    emit("close");
  } else {
    closeTimer = setTimeout(() => {
      showDetail.value = false;
      emit("close");
    }, 480);
  }
}

function flipToCover() {
  clearTimeout(flipTimer);
  viewingCover.value = true;
  playFlip();
  flipped.value = false;
  // intentionally no stopTypewriter — text state preserved for snap-back
}

function flipToDetail() {
  viewingCover.value = false;
  playFlip();
  flipped.value = true;
  snapTypewriter();
}

function onDetailKey(e) { if (e.key === "Escape") closeDetail(); }

// position:fixed scroll-lock — prevents iOS address bar from appearing/hiding
// (which changes dvh and causes visible page resize) when the modal opens/closes.
// scrollbar-gutter: stable in global CSS handles the gutter for most cases;
// the paddingRight compensation below covers browsers that don't support it.
let _scrollY = 0;
function lockScroll() {
  _scrollY = window.scrollY;
  const sbw = window.innerWidth - document.documentElement.clientWidth;
  if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${_scrollY}px`;
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.paddingRight = '';
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, _scrollY);
}

watch(showDetail, open => {
  if (open) {
    lockScroll();
    document.addEventListener("keydown", onDetailKey);
  } else {
    // Constructivist leave: cOnLeave calls unlockScroll() after the animation
    // completes so the body stays locked throughout the leave transition.
    if (props.layoutMode !== 'constructivist') {
      unlockScroll();
    }
    document.removeEventListener("keydown", onDetailKey);
  }
});

onUnmounted(() => {
  clearTimeout(flipTimer);
  clearTimeout(closeTimer);
  clearTimeout(typeTimer);
  bioReadyStop?.();
  unlockScroll();
  document.removeEventListener("keydown", onDetailKey);
});

const shortFinish = computed(() => {
  const { finished, date, finish } = props.book;
  if (finished !== undefined) return finished ? (date || "") : "in progress";
  if (finish) {
    const isStarted = /^started/i.test(finish);
    const d = finish.replace(/^(?:Finished|Started)\s*/i, "");
    return isStarted ? "in progress" : d;
  }
  return "";
});

const openBook = () => {
  const q = encodeURIComponent(`${props.book.name || ""} ${props.book.author || ""}`.trim());
  window.open(`https://www.google.com/search?tbm=bks&q=${q}`, "_blank", "noopener,noreferrer");
};

// ── Constructivist modal transitions ─────────────────────
const ghostNum = computed(() =>
  props.inProgress ? '—' : String(props.index).padStart(2, '0')
);

function cOnBeforeEnter(el) {
  gsap.set(el, { opacity: 0 });
}

function cOnEnter(el, done) {
  const panel    = el.querySelector('.cdm-panel');
  const coverBar = el.querySelector('.cdm-cover-bar');
  const coverWrap= el.querySelector('.cdm-cover-wrap');
  const eyebrow  = el.querySelector('.cdm-eyebrow');
  const title    = el.querySelector('.cdm-title-wrap');
  const slashDiv = el.querySelector('.cdm-head-slash');
  const metaRow  = el.querySelector('.cdm-meta-row');
  const body     = el.querySelector('.cdm-body');
  const foot     = el.querySelector('.cdm-foot');

  gsap.set(panel,    { y: 22, opacity: 0 });
  if (coverBar)  gsap.set(coverBar,  { scaleY: 0, transformOrigin: 'top' });
  if (coverWrap) gsap.set(coverWrap, { x: -10, opacity: 0 });
  if (eyebrow)   gsap.set(eyebrow,   { y: -4, opacity: 0 });
  if (title)     gsap.set(title,     { x: -14, opacity: 0 });
  if (slashDiv)  gsap.set(slashDiv,  { opacity: 0 });
  if (metaRow)   gsap.set(metaRow,   { y: 5, opacity: 0 });
  if (body)      gsap.set(body,      { opacity: 0, y: 4 });
  if (foot)      gsap.set(foot,      { y: 10, opacity: 0 });

  gsap.timeline({ onComplete: done })
    .to(el,        { opacity: 1,              duration: 0.18, ease: 'power1.out' })
    .to(panel,     { y: 0, opacity: 1,        duration: 0.26, ease: 'power2.out' }, 0)
    .to(coverBar,  { scaleY: 1,               duration: 0.28, ease: 'power2.out' }, 0.1)
    .to(coverWrap, { x: 0, opacity: 1,        duration: 0.28, ease: 'power2.out' }, 0.14)
    .to(eyebrow,   { y: 0, opacity: 1,        duration: 0.2,  ease: 'power2.out' }, 0.18)
    .to(title,     { x: 0, opacity: 1,        duration: 0.28, ease: 'power2.out' }, 0.22)
    .to(slashDiv,  { opacity: 1,              duration: 0.2,  ease: 'power1.out' }, 0.3)
    .to(metaRow,   { y: 0, opacity: 1,        duration: 0.2,  ease: 'power2.out' }, 0.34)
    .to(body,      { opacity: 1, y: 0,        duration: 0.24, ease: 'power1.out' }, 0.4)
    .to(foot,      { y: 0, opacity: 1,        duration: 0.2,  ease: 'power2.out' }, 0.44);
}

function cOnLeave(el, done) {
  const panel = el.querySelector('.cdm-panel');
  const { width, height } = panel.getBoundingClientRect();
  gsap.set(panel, { width, height, paddingBottom: 0 });
  gsap.timeline({
    onComplete: () => {
      unlockScroll();
      done();
      stopTypewriter();
      emit('close');
    },
  })
    .to(panel, { y: 18, opacity: 0, duration: 0.18, ease: 'power2.in' }, 0)
    .to(el,    { opacity: 0,        duration: 0.2,  ease: 'power1.in' }, 0);
}

function cCoverEnter(el, done) {
  gsap.fromTo(el, { x: '100%' }, { x: 0, duration: 0.26, ease: 'power3.out', onComplete: done });
}
function cCoverLeave(el, done) {
  gsap.to(el, { x: '100%', duration: 0.22, ease: 'power3.in', onComplete: done });
}

defineExpose({ open: openDetail });
</script>

<template>
  <Teleport to="body">
    <Transition name="do">
      <div
        v-if="showDetail && layoutMode !== 'constructivist'"
        class="detail-overlay"
        :style="accentColor ? { '--accent': accentColor } : {}"
        @click.self="closeDetail"
      >
          <div class="detail-aura" :style="auraStyle" aria-hidden="true"></div>
        <div class="flip-scene">
          <div class="flip-card" :class="{ 'flip-card-flipped': flipped }" role="dialog" :aria-label="book.name">

            <!-- Front: cover image — clickable when user navigated here from the thumb -->
            <div class="flip-front" :class="{ 'flip-front-peek': viewingCover }" @click="viewingCover ? flipToDetail() : null">
              <img v-if="book.img" :src="book.img" class="flip-bg-img" aria-hidden="true" crossorigin="anonymous" @load="onCoverLoad" />
              <img v-if="book.img" :src="book.img" :alt="book.name" class="flip-cover-img" />
              <div v-if="viewingCover" class="flip-front-hint" aria-hidden="true">tap to flip back</div>
            </div>

            <!-- Back: detail -->
            <div class="flip-back">
              <button class="detail-close" @click="closeDetail" aria-label="Close">×</button>

              <div class="detail-head">
                <img v-if="book.img" :src="book.img" :alt="book.name" class="detail-thumb" @click.stop="flipToCover" />
                <div class="detail-head-text">
                  <h2 class="detail-title">{{ tw.title }}<span v-if="twActive === 'title'" class="tw-cur" aria-hidden="true"></span></h2>
                  <p class="detail-author">{{ tw.author }}<span v-if="twActive === 'author'" class="tw-cur" aria-hidden="true"></span></p>
                  <div class="detail-meta-row">
                    <span class="detail-finish" :class="{ 'detail-finish-ip': inProgress }">{{ tw.finish }}<span v-if="twActive === 'finish'" class="tw-cur" aria-hidden="true"></span></span>
                    <span v-if="tw.pages" class="detail-pages">{{ tw.pages }}<span v-if="twActive === 'pages'" class="tw-cur tw-cur-sm" aria-hidden="true"></span></span>
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

              <button class="detail-open-btn" @click="openBook">Google Books &rarr;</button>
            </div>

          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Constructivist panel ──────────────────────────── -->
    <Transition :css="false" @before-enter="cOnBeforeEnter" @enter="cOnEnter" @leave="cOnLeave">
      <div
        v-if="showDetail && layoutMode === 'constructivist'"
        class="cdm-overlay"
        @click.self="closeDetail"
        role="dialog"
        aria-modal="true"
        :aria-label="book.name"
      >
        <div class="cdm-panel">
          <div class="cdm-ghost" aria-hidden="true">{{ ghostNum }}</div>
          <button class="cdm-close" @click="closeDetail" aria-label="Close">×</button>

          <div class="cdm-head">
            <div class="cdm-cover-col">
              <div class="cdm-cover-bar" :class="inProgress ? 'cdm-cover-bar-ip' : ''"></div>
              <div class="cdm-cover-wrap" :class="book.img ? 'cdm-cover-clickable' : ''" @click="book.img ? flipToCover() : null">
                <img v-if="book.img" :src="book.img" :alt="book.name" crossorigin="anonymous" @load="onCoverLoad">
                <div v-else class="cdm-cover-skel"></div>
              </div>
            </div>
            <div class="cdm-title-col">
              <div class="cdm-eyebrow" :class="{ 'cdm-eyebrow-zh': hasChinese(book.author || '') }">{{ tw.author }}<span v-if="twActive==='author'" class="tw-cur" aria-hidden="true"></span></div>
              <div class="cdm-title-wrap">
                <span
                  v-for="(c, i) in titleDisplayChars"
                  :key="i"
                  :class="{ 'cdm-char-ghost': c.ghost }"
                >{{ c.ch }}</span>
              </div>
              <div class="cdm-head-slash">
                <div class="cdm-slash-line" :class="inProgress ? 'cdm-slash-line-ip' : ''"></div>
                <div class="cdm-slash-tag">{{ inProgress ? 'Now Reading' : 'Finished' }}</div>
              </div>
              <div class="cdm-meta-row">
                <span class="cdm-finish" :class="inProgress ? 'cdm-finish-ip' : ''">
                  <span v-if="inProgress" class="cdm-ip-dot" aria-hidden="true"></span>
                  {{ tw.finish }}<span v-if="twActive==='finish'" class="tw-cur" aria-hidden="true"></span>
                </span>
                <span class="cdm-pages" :style="{ visibility: tw.pages ? 'visible' : 'hidden' }">{{ tw.pages || '    ' }}<span v-if="twActive==='pages'" class="tw-cur tw-cur-sm" aria-hidden="true"></span></span>
              </div>
            </div>
          </div>

          <div class="cdm-body">
            <template v-if="bioLoading && twDone.header">
              <p class="cdm-bio-loading">loading…</p>
            </template>
            <template v-else-if="bio">
              <p ref="bioEl" class="cdm-bio">{{ tw.bio }}<span v-if="twActive==='bio'" class="tw-cur" aria-hidden="true"></span></p>
              <a v-if="bioSource && twDone.bio" :href="bioSource.url" target="_blank" rel="noopener noreferrer" class="cdm-bio-src">via {{ bioSource.label }} →</a>
            </template>
            <p v-else-if="twDone.header && !bioLoading" class="cdm-bio-empty">No synopsis available.</p>

            <template v-if="typedTags.length">
              <div class="cdm-body-slash">
                <div class="cdm-slash-line"></div>
              </div>
              <div class="cdm-tags">
                <span v-for="(t, i) in typedTags" :key="i" class="cdm-tag">{{ t }}<span v-if="twActive==='tag' && activeTagIdx===i" class="tw-cur tw-cur-sm" aria-hidden="true"></span></span>
              </div>
            </template>

            <p v-if="tw.note" class="cdm-note">{{ tw.note }}<span v-if="twActive==='note'" class="tw-cur" aria-hidden="true"></span></p>
          </div>

          <div class="cdm-foot">
            <button class="cdm-google" @click="openBook">
              Google Books <span class="cdm-arrow">→</span>
            </button>
          </div>

          <!-- Cover view (slides in from right) -->
          <Transition :css="false" @enter="cCoverEnter" @leave="cCoverLeave">
            <div v-if="viewingCover && book.img" class="cdm-cover-view" @click="viewingCover = false">
              <div class="cdm-cover-view-bg" :style="{ backgroundImage: `url(${book.img})` }" aria-hidden="true"></div>
              <img :src="book.img" :alt="book.name" class="cdm-cover-view-img" crossorigin="anonymous">
              <div class="cdm-cover-hint" aria-hidden="true">tap to return</div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
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

.detail-aura {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: background 900ms ease;
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

.flip-front { background: #0e0d08; }
.flip-front-peek { cursor: pointer; }
.flip-front-peek .flip-cover-img { transition: transform 300ms ease; }
.flip-front-peek:hover .flip-cover-img { transform: scale(1.025); }

.flip-front-hint {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(200, 186, 140, 0.55);
  background: rgba(14, 13, 8, 0.7);
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
  pointer-events: none;
  animation: hint-fade 1.8s ease forwards;
}
@keyframes hint-fade {
  0%   { opacity: 1; }
  60%  { opacity: 1; }
  100% { opacity: 0; }
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
  cursor: zoom-in;
  transition: opacity 150ms ease, transform 150ms ease;
}
.detail-thumb:hover { opacity: 0.8; transform: scale(1.04); }

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

.detail-pages {
  font-size: 0.65rem;
  font-weight: 600;
  color: #3c3924;
  letter-spacing: 0.04em;
}

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

.do-enter-active { transition: opacity 200ms ease; }
.do-leave-active { transition: opacity 180ms ease; }
.do-enter-from, .do-leave-to { opacity: 0; }

/* ── Constructivist Detail Modal ─────────────────────── */
.cdm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.88);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.cdm-panel {
  width: 100%;
  max-width: 460px;
  height: min(560px, 88dvh);
  max-height: 88dvh;
  background: #0d0b08;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  border: 1px solid #2a2618;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%);
}

.cdm-ghost {
  position: absolute;
  right: -0.2rem;
  top: -1.4rem;
  font-family: 'Bebas Neue', 'Oswald', sans-serif;
  font-size: 13rem;
  line-height: 0.82;
  color: rgba(200, 186, 140, 0.032);
  pointer-events: none;
  user-select: none;
  z-index: 0;
  letter-spacing: -0.02em;
}

.cdm-close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  z-index: 20;
  width: 32px;
  height: 26px;
  background: transparent;
  border: 1px solid #2a2618;
  color: #5a5440;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: polygon(5px 0, 100% 0, calc(100% - 5px) 100%, 0 100%);
  transition: background 120ms, color 120ms;
  font-family: sans-serif;
}
.cdm-close:hover { background: #1a1812; color: #c8ba8c; }

/* Head */
.cdm-head {
  display: flex;
  align-items: stretch;
  flex-shrink: 0;
  height: 128px;
  overflow: hidden;
  position: relative;
  z-index: 1;
  border-bottom: 1px solid #2a2618;
}

.cdm-cover-col { display: flex; flex-shrink: 0; }

.cdm-cover-bar {
  width: 4px;
  background: #c8ba8c;
  flex-shrink: 0;
}
.cdm-cover-bar-ip { background: #7a8c58; }

.cdm-cover-wrap {
  width: 86px;
  height: 128px;
  background: #131108;
  flex-shrink: 0;
  overflow: hidden;
  clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
}
.cdm-cover-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.cdm-cover-skel {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #181610 0%, #26220e 50%, #181610 100%);
  background-size: 300% 100%;
  animation: cdm-shimmer 1.6s ease-in-out infinite;
}
@keyframes cdm-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.cdm-title-col {
  flex: 1;
  min-width: 0;
  padding: 0.72rem 3.25rem 0.72rem 0.8rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  overflow: hidden;
}

.cdm-eyebrow {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.46rem;
  font-weight: 700;
  letter-spacing: 0.5em;
  color: #c8ba8c;
  text-transform: uppercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 1.3em;
  flex-shrink: 0;
}
.cdm-eyebrow-zh {
  font-size: 0.68rem;
  letter-spacing: 0.15em;
}

.cdm-title-wrap {
  font-family: 'Bebas Neue', 'Oswald', sans-serif;
  font-size: clamp(1.1rem, 4.5vw, 1.6rem);
  letter-spacing: 0.03em;
  line-height: 0.94;
  color: #e0d4b4;
  height: calc(2 * 0.94em);
  flex-shrink: 0;
  overflow: hidden;
}
/* Untyped chars — transparent, still occupy full layout space */
.cdm-char-ghost {
  color: transparent;
  user-select: none;
}

/* Slash dividers */
.cdm-head-slash,
.cdm-body-slash {
  position: relative;
  height: 1.15rem;
  overflow: visible;
  flex-shrink: 0;
}
.cdm-body-slash { height: 1rem; }

.cdm-slash-line {
  position: absolute;
  left: -4%;
  width: 108%;
  height: 1px;
  background: rgba(200, 186, 140, 0.18);
  top: 50%;
  transform: rotate(-1.6deg);
}
.cdm-slash-line-ip { background: rgba(122, 140, 88, 0.28); }

.cdm-slash-tag {
  position: absolute;
  top: 50%;
  left: 0;
  translate: 0 -50%;
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.43rem;
  font-weight: 700;
  letter-spacing: 0.42em;
  color: #3c3924;
  background: #0d0b08;
  padding: 0 0.5rem;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Meta */
.cdm-meta-row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  height: 1.4em;
  flex-shrink: 0;
  overflow: hidden;
}

.cdm-finish {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #a87e3c;
  text-transform: uppercase;
}
.cdm-finish-ip {
  color: #7a8c58;
  display: flex;
  align-items: center;
  gap: 5px;
}

.cdm-ip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #7a8c58;
  animation: cdm-pulse 2.4s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes cdm-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(122, 140, 88, 0.6); }
  50%       { box-shadow: 0 0 0 4px rgba(122, 140, 88, 0); }
}

.cdm-pages {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.52rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: #3c3924;
}

/* Body */
.cdm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  position: relative;
  z-index: 1;
}

.cdm-bio {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.755rem;
  line-height: 1.68;
  color: #6a6248;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
}

.cdm-bio-loading {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.65rem;
  color: #3c3924;
  letter-spacing: 0.2em;
  animation: cdm-bio-pulse 1.4s ease-in-out infinite;
  margin: 0;
}
@keyframes cdm-bio-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}

.cdm-bio-empty {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.65rem;
  color: #3c3924;
  font-style: italic;
  margin: 0;
}

.cdm-bio-src {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: #3c3924;
  text-decoration: none;
  text-transform: uppercase;
  margin-top: -0.25rem;
  transition: color 120ms;
}
.cdm-bio-src:hover { color: #7a8c58; }

.cdm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cdm-tag {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.46rem;
  font-weight: 700;
  padding: 3px 11px;
  background: #1c2010;
  color: #607840;
  border: 1px solid #2a3018;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  clip-path: polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
}

.cdm-note {
  font-size: 0.7rem;
  color: #524e3c;
  line-height: 1.55;
  font-style: italic;
  margin: 0;
}

/* Footer */
.cdm-foot {
  flex-shrink: 0;
  padding: 0.65rem 1rem 0.9rem;
  border-top: 1px solid #2a2618;
  position: relative;
  z-index: 1;
}

.cdm-google {
  width: 100%;
  padding: 0.65rem 1.5rem;
  background: #1c2010;
  border: 1px solid #2a3018;
  color: #7a8c58;
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.32em;
  text-transform: uppercase;
  cursor: pointer;
  clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
  transition: background 140ms, color 140ms;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.cdm-google:hover { background: #222e12; color: #9aac70; }
.cdm-arrow { font-size: 0.9em; }

/* ── Mobile overrides (< 580px) ──────────────────────── */
@media (max-width: 579px) {
  .cdm-overlay { padding: 0.75rem; }

  .cdm-panel {
    height: min(88dvh, 580px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  /* Larger close button for touch */
  .cdm-close {
    width: 44px;
    height: 38px;
    font-size: 1.3rem;
  }

  /* Taller head with bigger cover */
  .cdm-head { height: 152px; }

  .cdm-cover-wrap {
    width: 106px;
    height: 152px;
  }

  /* More padding around title area */
  .cdm-title-col {
    padding: 0.8rem 3.75rem 0.8rem 0.9rem;
    gap: 4px;
  }

  /* Larger title on mobile — 3 lines fit within the taller head */
  .cdm-title-wrap {
    font-size: clamp(1.3rem, 6vw, 1.8rem);
    height: calc(3 * 0.94em);
  }

  /* Larger author eyebrow */
  .cdm-eyebrow {
    font-size: 0.52rem;
    letter-spacing: 0.4em;
  }
  .cdm-eyebrow-zh { font-size: 0.72rem; }

  /* Larger meta */
  .cdm-finish { font-size: 0.65rem; }
  .cdm-pages  { font-size: 0.58rem; }

  /* More body padding, bigger text */
  .cdm-body {
    padding: 0.9rem 1.1rem 0;
    gap: 0.75rem;
  }

  .cdm-bio {
    font-size: 0.82rem;
    -webkit-line-clamp: 7;
    line-height: 1.62;
  }

  .cdm-bio-loading,
  .cdm-bio-empty { font-size: 0.72rem; }

  .cdm-bio-src { font-size: 0.56rem; }

  /* Bigger tags for touch */
  .cdm-tag {
    font-size: 0.52rem;
    padding: 4px 13px;
  }

  .cdm-note { font-size: 0.78rem; }

  /* Taller footer button */
  .cdm-foot {
    padding: 0.75rem 1rem calc(0.9rem + env(safe-area-inset-bottom, 0px));
  }

  .cdm-google {
    padding: 0.85rem 1.5rem;
    font-size: 0.62rem;
    letter-spacing: 0.28em;
  }
}

/* Cover clickable state */
.cdm-cover-clickable { cursor: zoom-in; }
.cdm-cover-clickable:hover img { opacity: 0.85; }
.cdm-cover-clickable img { transition: opacity 150ms ease; }

/* Cover full view */
.cdm-cover-view {
  position: absolute;
  inset: 0;
  background: #0a0804;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
}

.cdm-cover-view-bg {
  position: absolute;
  inset: -10%;
  width: 120%;
  height: 120%;
  background-size: cover;
  background-position: center;
  filter: blur(32px) brightness(0.28) saturate(0.6);
  pointer-events: none;
}

.cdm-cover-view-img {
  position: relative;
  z-index: 1;
  max-width: 58%;
  max-height: calc(100% - 3.5rem);
  object-fit: contain;
  display: block;
}

.cdm-cover-hint {
  position: absolute;
  bottom: 0.8rem;
  left: 50%;
  translate: -50% 0;
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.48rem;
  font-weight: 700;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  color: rgba(200, 186, 140, 0.38);
  white-space: nowrap;
  pointer-events: none;
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
  padding: 3px 14px;
  animation: cdm-hint-fade 2.2s ease forwards;
}
@keyframes cdm-hint-fade {
  0%, 55%  { opacity: 1; }
  100%     { opacity: 0.2; }
}
</style>
