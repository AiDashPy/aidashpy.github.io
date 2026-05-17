<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(Flip, ScrollTrigger);
import { scrollToTop } from "../composables/useLenis";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import BookEntry from "../components/BookEntry.vue";
import BookDetail from "../components/BookDetail.vue";
import WebHeader from "../components/WebHeader.vue";
import WebFooter from "../components/WebFooter.vue";
import YearBadge from "../components/YearBadge.vue";
import SearchOverlay from "../components/SearchOverlay.vue";

NProgress.configure({ showSpinner: false });

const router = useRouter();
const showSearch = ref(false);
let keyBuffer = "";
let keyTimer = null;
let cScrollTriggers = [];
let cAnimTimer = null;

const WORKER = import.meta.env.VITE_WORKER_URL ?? "https://aidashpy-api.adiashpy.workers.dev";

const layoutMode   = ref('poster');
const showPinOverlay = ref(false);
const pinValue     = ref('');
const pinError     = ref(false);

async function fetchLayoutMode() {
  try {
    const res = await fetch(`${WORKER}/layout`);
    const { mode } = await res.json();
    layoutMode.value = mode ?? 'poster';
  } catch {}
}

async function submitPin(pin) {
  const targetMode = layoutMode.value === 'poster' ? 'constructivist' : 'poster';
  try {
    const res = await fetch(`${WORKER}/layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, mode: targetMode }),
    });
    if (!res.ok) { pinError.value = true; pinValue.value = ''; return; }
    layoutMode.value = targetMode;
    showPinOverlay.value = false;
    pinValue.value = '';
  } catch { pinError.value = true; pinValue.value = ''; }
}

function bookFinish(b) {
  const { finished, date, finish } = b;
  if (finished !== undefined) return finished ? (date || '') : 'in progress';
  if (finish) {
    const isStarted = /^started/i.test(finish);
    const d = finish.replace(/^(?:Finished|Started)\s*/i, '');
    return isStarted ? 'in progress' : d;
  }
  return '';
}

function onKeydown(e) {
  if (showPinOverlay.value) {
    if (e.key === 'Escape') { showPinOverlay.value = false; pinValue.value = ''; pinError.value = false; return; }
    if (e.key === 'Backspace') { pinValue.value = pinValue.value.slice(0, -1); pinError.value = false; return; }
    if (/^\d$/.test(e.key) && pinValue.value.length < 4) {
      pinValue.value += e.key; pinError.value = false;
      if (pinValue.value.length === 4) submitPin(pinValue.value);
    }
    return;
  }
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") { showSearch.value = false; return; }
  if (e.key === "/" && !showSearch.value) { e.preventDefault(); showSearch.value = true; return; }
  if (showSearch.value) return;
  if (e.key.length !== 1) return;
  keyBuffer += e.key.toLowerCase();
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => { keyBuffer = ""; }, 1000);
  if (keyBuffer.endsWith("admin"))  { keyBuffer = ""; clearTimeout(keyTimer); router.push("/admin"); }
  if (keyBuffer.endsWith("change")) { keyBuffer = ""; clearTimeout(keyTimer); showPinOverlay.value = true; pinValue.value = ''; pinError.value = false; }
}

const allEntries = computed(() =>
  sortedYears.value.flatMap((y) => y.entries.map((e) => ({ ...e, year: y.year })))
);

const selectedYear = ref(0);
const showYears = ref(false);
const fabFooterHidden = ref(false);

const footerSentinel = ref(null);
let footerObs = null;
const displayYear = ref('');
const displayCount = ref(0);
const isCounting = ref(false);
let countTimer = null;
let countBookTimer = null;
const viewMode = ref(localStorage.getItem("bookViewMode") ?? "list");

async function switchView(mode) {
  if (mode === viewMode.value) return;
  const state = Flip.getState("[data-flip-id]");
  viewMode.value = mode;
  localStorage.setItem("bookViewMode", mode);
  await nextTick();
  Flip.from(state, {
    duration: 0.48,
    ease: "power2.inOut",
    absolute: true,
    stagger: { amount: 0.1, from: "start" },
    onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }),
    onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.22 }),
  });
}
const priorityCount = 6;
const books = ref([]);

function parseDateFromBook(b) {
  if (!b) return 0;
  if (b.date) {
    const m = b.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return Date.UTC(+m[3], +m[1] - 1, +m[2]);
    const t = Date.parse(b.date);
    if (!Number.isNaN(t)) return t;
  }
  if (b.finish) {
    const t = Date.parse(b.finish.replace(/^(?:Finished|Started)\s*/i, ""));
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

const sortedYears = computed(() =>
  books.value.map((y) => ({
    ...y,
    entries: [...(y.entries || [])].sort((a, b) => parseDateFromBook(b) - parseDateFromBook(a)),
  }))
);

const entriesForSelected = computed(() => sortedYears.value[selectedYear.value]?.entries ?? []);

const currentYear = computed(() => {
  const m = String(sortedYears.value[selectedYear.value]?.year ?? "").match(/\d{4}/);
  return m ? m[0] : "";
});

function prefetchImages(entries = []) {
  entries.forEach((e, i) => {
    if (!e?.img) return;
    const img = new Image(); img.src = e.img;
    if (i < priorityCount) {
      try {
        const l = document.createElement("link");
        l.rel = "preload"; l.as = "image"; l.href = e.img;
        l.onload = () => l.remove(); l.onerror = () => l.remove();
        document.head.appendChild(l);
      } catch {}
    }
  });
}

watch(() => entriesForSelected.value, prefetchImages);

watch(selectedYear, () => {
  if (countTimer)     { clearInterval(countTimer);     countTimer     = null; }
  if (countBookTimer) { clearInterval(countBookTimer); countBookTimer = null; }

  // --- year digits ---
  const fromYear = parseInt(displayYear.value) || 0;
  const toYear   = parseInt(currentYear.value)  || 0;
  if (fromYear && toYear && fromYear !== toYear) {
    const dir   = toYear > fromYear ? 1 : -1;
    const steps = Math.abs(toYear - fromYear);
    if (steps === 1) {
      displayYear.value = String(toYear);
    } else {
      isCounting.value = true;
      const tickMs = Math.max(50, Math.min(150, 400 / steps));
      let cur = fromYear;
      countTimer = setInterval(() => {
        cur += dir;
        displayYear.value = String(cur);
        if (cur === toYear) { clearInterval(countTimer); countTimer = null; isCounting.value = false; }
      }, tickMs);
    }
  } else {
    displayYear.value = currentYear.value;
  }

  // --- book count ---
  const fromCount = displayCount.value;
  const toCount   = entriesForSelected.value.length;
  if (fromCount !== toCount) {
    const dir   = toCount > fromCount ? 1 : -1;
    const steps = Math.abs(toCount - fromCount);
    const tickMs = Math.max(16, Math.min(80, 400 / steps));
    let cur = fromCount;
    countBookTimer = setInterval(() => {
      cur += dir;
      displayCount.value = cur;
      if (cur === toCount) { clearInterval(countBookTimer); countBookTimer = null; }
    }, tickMs);
  }
});

onMounted(async () => {
  document.addEventListener("keydown", onKeydown);
  fetchLayoutMode();
  NProgress.start();
  try {
    const workerUrl = import.meta.env.VITE_WORKER_URL ?? "https://aidashpy-api.adiashpy.workers.dev";
    const res = await fetch(`${workerUrl}/books.json`);
    books.value = await res.json();
  } catch {}
  NProgress.done();
  displayYear.value  = currentYear.value;
  displayCount.value = entriesForSelected.value.length;
  await nextTick();
  if (layoutMode.value === 'constructivist') setupCAnimations();
  footerObs = new IntersectionObserver(([e]) => { fabFooterHidden.value = e.isIntersecting; }, { threshold: 0 });
  if (footerSentinel.value) footerObs.observe(footerSentinel.value);
});

function isInProgress(b) {
  return b.finished === false || (b.finish && /^started/i.test(b.finish));
}

const nowReadingForYear = computed(() =>
  entriesForSelected.value.filter(isInProgress)
);

const finishedEntries = computed(() =>
  entriesForSelected.value.filter((b) => !isInProgress(b))
);

const listEntries = computed(() => [
  ...nowReadingForYear.value,
  ...finishedEntries.value,
]);

const mosaicBook = ref(null);
const mosaicDetailRef = ref(null);

async function openMosaicDetail(b) {
  mosaicBook.value = b;
  await nextTick();
  mosaicDetailRef.value?.open();
}

const cBook = ref(null);
const cDetailRef = ref(null);

async function openCDetail(b) {
  cBook.value = b;
  await nextTick();
  cDetailRef.value?.open();
}

function selectYear(i) {
  if (i === selectedYear.value) { showYears.value = false; return; }
  scrollToTop();
  selectedYear.value = i;
  showYears.value = false;
}
function toggleYears() { showYears.value = !showYears.value; }
function closeYears() { showYears.value = false; }

watch(showYears, (open) => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = open ? "hidden" : "";
    document.documentElement.style.overflow = open ? "hidden" : "";
  }
});

function cleanupCScrollTriggers() {
  cScrollTriggers.forEach(st => st.kill());
  cScrollTriggers = [];
}

function _setCStates(root) {
  if (viewMode.value === 'list') {
    root.querySelectorAll('.c-book').forEach(row => {
      const accent = row.querySelector('.c-book-accent');
      const cover  = row.querySelector('.c-book-cover, .c-book-cover-skel');
      const title  = row.querySelector('.c-book-title');
      const ghost  = row.querySelector('.c-book-ghost');
      const metas  = row.querySelectorAll('.c-book-author, .c-book-tags, .c-book-note, .c-book-meta');
      gsap.set(row, { opacity: 0 });
      if (accent) gsap.set(accent, { scaleY: 0, transformOrigin: 'top' });
      if (cover)  gsap.set(cover,  { scale: 0.88, opacity: 0 });
      if (title)  gsap.set(title,  { y: 6, opacity: 0 });
      if (ghost)  gsap.set(ghost,  { x: 10, opacity: 0 });
      metas.forEach(el => gsap.set(el, { y: 5, opacity: 0 }));
    });
  } else {
    root.querySelectorAll('.c-mosaic-item').forEach(item => {
      gsap.set(item, { opacity: 0, scale: 0.92 });
    });
  }
}

function _runCAnims(root) {
  const vh = window.innerHeight;
  if (viewMode.value === 'list') {
    root.querySelectorAll('.c-book').forEach(row => {
      const accent = row.querySelector('.c-book-accent');
      const cover  = row.querySelector('.c-book-cover, .c-book-cover-skel');
      const title  = row.querySelector('.c-book-title');
      const ghost  = row.querySelector('.c-book-ghost');
      const metas  = row.querySelectorAll('.c-book-author, .c-book-tags, .c-book-note, .c-book-meta');
      const tl = gsap.timeline({ paused: true })
        .to(row,    { opacity: 1, duration: 0.01 })
        .to(accent, { scaleY: 1, duration: 0.28, ease: 'power2.out' }, 0)
        .to(cover,  { scale: 1, opacity: 1, duration: 0.36, ease: 'power2.out' }, 0.04)
        .to(ghost,  { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, 0.06)
        .to(title,  { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }, 0.1)
        .to(metas,  { y: 0, opacity: 1, duration: 0.26, ease: 'power2.out', stagger: 0.04 }, 0.16);
      if (row.getBoundingClientRect().top < vh) {
        tl.play();
      } else {
        cScrollTriggers.push(ScrollTrigger.create({
          trigger: row, start: 'top bottom', once: true,
          onEnter: () => tl.play(),
        }));
      }
    });
  } else {
    root.querySelectorAll('.c-mosaic-item').forEach((item, i) => {
      if (item.getBoundingClientRect().top < vh) {
        gsap.to(item, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', delay: (i % 6) * 0.028 });
      } else {
        cScrollTriggers.push(ScrollTrigger.create({
          trigger: item, start: 'top bottom', once: true,
          onEnter: () => gsap.to(item, { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out', delay: (i % 6) * 0.028 }),
        }));
      }
    });
  }
}

async function setupCAnimations() {
  cleanupCScrollTriggers();
  await nextTick();
  _setCStates(document);
  _runCAnims(document);
}

function onCLeave(el, done) {
  gsap.to(el, { opacity: 0, duration: 0.1, ease: 'power1.in', onComplete: done });
}

function onCBeforeEnter(el) {
  cleanupCScrollTriggers();
  _setCStates(el);
}

function onCEnter(el, done) {
  _runCAnims(el);
  done();
}

watch(layoutMode, async (mode) => {
  if (mode !== 'constructivist') { cleanupCScrollTriggers(); return; }
  await nextTick();
  setupCAnimations();
});

watch(selectedYear, () => {
  if (layoutMode.value !== 'constructivist') return;
  cleanupCScrollTriggers();
});

watch(viewMode, () => {
  if (layoutMode.value !== 'constructivist') return;
  cleanupCScrollTriggers();
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  clearTimeout(keyTimer);
  if (countTimer)     clearInterval(countTimer);
  if (countBookTimer) clearInterval(countBookTimer);
  cleanupCScrollTriggers();
  footerObs?.disconnect();
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
});
</script>

<template>
  <!-- PIN overlay -->
  <Transition name="h-pin-fade">
    <div v-if="showPinOverlay" class="h-pin-overlay" @click.self="showPinOverlay = false; pinValue = ''; pinError = false">
      <div class="h-pin-box">
        <div class="h-pin-label">ENTER PIN</div>
        <div class="h-pin-dots">
          <span v-for="i in 4" :key="i" class="h-pin-dot" :class="{ 'h-pin-dot--on': pinValue.length >= i, 'h-pin-dot--err': pinError }"></span>
        </div>
        <div v-if="pinError" class="h-pin-err">incorrect</div>
      </div>
    </div>
  </Transition>

  <div class="root">
    <WebHeader />

    <template v-if="layoutMode === 'poster'">
    <div class="shell">
      <!-- Sidebar -->
      <aside class="sidebar">
        <nav class="year-nav">
          <YearBadge
            v-for="(y, i) in sortedYears"
            :key="y.year"
            :year="y.year"
            :count="y.entries.length"
            :active="i === selectedYear"
            @select="selectYear(i)"
          />
        </nav>
      </aside>

      <!-- Main -->
      <main class="main">

        <div class="year-section">

            <!-- Year header -->
            <header class="year-head">
              <div class="year-head-left">
                <span class="year-num" :aria-label="displayYear">
                  <span v-for="(c, ci) in displayYear.split('')" :key="ci + '-' + c" class="yn-c" :style="{ '--ci': isCounting ? 0 : ci, 'animation-duration': isCounting ? '80ms' : '420ms' }">{{ c }}</span>
                </span>
                <span class="year-count"><span class="year-count-num">{{ displayCount }}</span>&thinsp;books</span>
              </div>
              <div class="view-toggle" role="group" aria-label="View mode">
                <button
                  class="vt-btn"
                  :class="{ 'vt-active': viewMode === 'list' }"
                  @click="switchView('list')"
                  aria-label="List view"
                  title="List view"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <line x1="4" y1="2.5" x2="13" y2="2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <line x1="4" y1="7"   x2="13" y2="7"   stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <line x1="4" y1="11.5" x2="13" y2="11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <circle cx="1.5" cy="2.5"  r="1" fill="currentColor"/>
                    <circle cx="1.5" cy="7"    r="1" fill="currentColor"/>
                    <circle cx="1.5" cy="11.5" r="1" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  class="vt-btn"
                  :class="{ 'vt-active': viewMode === 'mosaic' }"
                  @click="switchView('mosaic')"
                  aria-label="Cover grid"
                  title="Cover grid"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <rect x="1" y="1"   width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                    <rect x="8" y="1"   width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                    <rect x="1" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                    <rect x="8" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                </button>
              </div>
            </header>

            <!-- Book list / mosaic — transitions on year or view change -->
            <Transition name="ys-list" mode="out-in">
              <ol v-if="viewMode === 'list'" :key="selectedYear" class="book-list">
                <BookEntry
                  v-for="(b, idx) in listEntries"
                  :key="selectedYear + '-' + b.name"
                  :book="b"
                  :index="isInProgress(b) ? 0 : finishedEntries.length - (idx - nowReadingForYear.length)"
                  :in-progress="isInProgress(b)"
                  :priority="idx < priorityCount"
                  :style="{ '--i': idx }"
                  :flip-id="b.img ? 'cover-' + b.name : ''"
                />
              </ol>
              <div v-else :key="selectedYear" class="mosaic">
                <button
                  v-for="(b, idx) in listEntries"
                  :key="idx + '-' + b.name"
                  class="mosaic-cover"
                  :class="{ 'mosaic-ip': isInProgress(b) }"
                  :style="{ '--mi': idx }"
                  :title="b.name + ' — ' + b.author"
                  @click="openMosaicDetail(b)"
                >
                  <img
                    v-if="b.img"
                    :src="b.img"
                    :alt="b.name"
                    :loading="idx < 12 ? 'eager' : 'lazy'"
                    decoding="async"
                    class="mosaic-img"
                    :data-flip-id="b.img ? 'cover-' + b.name : undefined"
                  />
                  <div v-else class="mosaic-empty"></div>
                  <span class="mosaic-title">{{ b.name }}</span>
                  <span v-if="isInProgress(b)" class="mosaic-ip-dot" aria-hidden="true"></span>
                </button>
              </div>
            </Transition>

          </div>
      </main>
    </div>

    <!-- Mobile FAB -->
    <button class="fab" :class="{ 'fab-off': showYears || fabFooterHidden }" @click.stop="toggleYears" aria-label="Open archive">
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true">
        <line x1="0" y1="1"   x2="17" y2="1"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="0" y1="6"   x2="17" y2="6"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="0" y1="11"  x2="17" y2="11"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>

    <div class="trap" :class="showYears ? 'trap-on' : ''" @click="closeYears" aria-hidden="true"></div>

    <aside class="drawer" :class="showYears ? 'drawer-open' : ''" :aria-hidden="!showYears">
      <div class="drawer-header">
        <span class="drawer-title">Archive</span>
        <button class="drawer-close" @click="closeYears" aria-label="Close">×</button>
      </div>
      <nav class="year-nav drawer-nav">
        <YearBadge
          v-for="(y, i) in sortedYears"
          :key="y.year + '-d'"
          :year="y.year"
          :count="y.entries.length"
          :active="i === selectedYear"
          @select="selectYear(i)"
        />
      </nav>
    </aside>
    </template>

    <!-- ══ CONSTRUCTIVIST LAYOUT ══════════════════════════════ -->
    <template v-else>
      <div class="c-corner-rule" aria-hidden="true"></div>
      <div class="c-shell">

        <aside class="c-sidebar">
          <div class="c-sidebar-eyebrow">Archive</div>
          <nav class="c-year-nav">
            <button
              v-for="(y, i) in sortedYears"
              :key="y.year"
              class="c-year-btn"
              :class="{ 'c-year-btn-active': i === selectedYear }"
              @click="selectYear(i)"
            >
              <div class="c-year-bar"></div>
              <div>
                <div class="c-year-num">{{ y.year }}</div>
                <div class="c-year-ct">{{ y.entries.length }} books</div>
              </div>
            </button>
          </nav>
        </aside>

        <main class="c-main">
          <div class="c-ghost-year" aria-hidden="true">{{ displayYear }}</div>

          <div class="c-year-head">
            <div class="c-year-head-left">
              <span class="c-year-display">{{ displayYear }}</span>
              <span class="c-book-count">{{ displayCount }}&thinsp;books</span>
            </div>
            <div class="c-view-toggle" role="group" aria-label="View mode">
              <button class="c-vt-btn" :class="{ 'c-vt-active': viewMode === 'list' }" @click="switchView('list')" aria-label="List view" title="List view">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <line x1="4" y1="2.5" x2="13" y2="2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <line x1="4" y1="7"   x2="13" y2="7"   stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <line x1="4" y1="11.5" x2="13" y2="11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  <circle cx="1.5" cy="2.5"  r="1" fill="currentColor"/>
                  <circle cx="1.5" cy="7"    r="1" fill="currentColor"/>
                  <circle cx="1.5" cy="11.5" r="1" fill="currentColor"/>
                </svg>
              </button>
              <button class="c-vt-btn" :class="{ 'c-vt-active': viewMode === 'mosaic' }" @click="switchView('mosaic')" aria-label="Cover grid" title="Cover grid">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="1" y="1"   width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                  <rect x="8" y="1"   width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                  <rect x="1" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                  <rect x="8" y="7.5" width="5" height="5.5" rx="1" stroke="currentColor" stroke-width="1.3"/>
                </svg>
              </button>
            </div>
          </div>

          <Transition mode="out-in" :css="false" @leave="onCLeave" @before-enter="onCBeforeEnter" @enter="onCEnter">

            <!-- List -->
            <div v-if="viewMode === 'list'" :key="selectedYear" class="c-list-view">

              <template v-if="nowReadingForYear.length">
                <div class="c-slash">
                  <div class="c-slash-line"></div>
                  <div class="c-slash-tag">Now Reading</div>
                </div>
                <div class="c-book-list">
                  <div
                    v-for="(b, idx) in nowReadingForYear"
                    :key="b.name"
                    class="c-book c-book-ip"
                    @click="openCDetail(b)"
                  >
                    <div class="c-book-ghost" aria-hidden="true">{{ String(idx + 1).padStart(2, '0') }}</div>
                    <div class="c-book-inner">
                      <div class="c-book-accent"></div>
                      <img v-if="b.img" class="c-book-cover" :src="b.img" :alt="b.name" loading="eager" crossorigin="anonymous">
                      <div v-else class="c-book-cover-skel"></div>
                      <div class="c-book-body">
                        <div class="c-book-title">{{ b.name }}</div>
                        <div class="c-book-author">{{ b.author }}</div>
                        <div v-if="b.tags?.length" class="c-book-tags">
                          <span v-for="t in b.tags.slice(0, 4)" :key="t" class="c-book-tag">{{ t }}</span>
                        </div>
                        <div v-if="b.note" class="c-book-note">{{ b.note }}</div>
                      </div>
                      <div class="c-book-meta">
                        <div class="c-book-ip-dot"></div>
                        <span class="c-book-ip-label">Reading</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <template v-if="finishedEntries.length">
                <div class="c-slash">
                  <div class="c-slash-line"></div>
                  <div class="c-slash-tag">Finished</div>
                </div>
                <div class="c-book-list">
                  <div
                    v-for="(b, idx) in finishedEntries"
                    :key="b.name"
                    class="c-book"
                    @click="openCDetail(b)"
                  >
                    <div class="c-book-ghost" aria-hidden="true">{{ String(finishedEntries.length - idx).padStart(2, '0') }}</div>
                    <div class="c-book-inner">
                      <div class="c-book-accent"></div>
                      <img v-if="b.img" class="c-book-cover" :src="b.img" :alt="b.name" :loading="idx < 6 ? 'eager' : 'lazy'" crossorigin="anonymous">
                      <div v-else class="c-book-cover-skel"></div>
                      <div class="c-book-body">
                        <div class="c-book-title">{{ b.name }}</div>
                        <div class="c-book-author">{{ b.author }}</div>
                        <div v-if="b.tags?.length" class="c-book-tags">
                          <span v-for="t in b.tags.slice(0, 4)" :key="t" class="c-book-tag">{{ t }}</span>
                        </div>
                        <div v-if="b.note" class="c-book-note">{{ b.note }}</div>
                      </div>
                      <div class="c-book-meta">
                        <span class="c-book-date">{{ bookFinish(b) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

            </div>

            <!-- Mosaic -->
            <div v-else :key="selectedYear + '-m'" class="c-mosaic">
              <button
                v-for="(b, idx) in listEntries"
                :key="b.name"
                class="c-mosaic-item"
                :class="{ 'c-mosaic-item-ip': isInProgress(b) }"
                :style="{ '--mi': idx }"
                :title="b.name + ' — ' + b.author"
                @click="openCDetail(b)"
              >
                <img v-if="b.img" class="c-mosaic-img" :src="b.img" :alt="b.name" :loading="idx < 12 ? 'eager' : 'lazy'" decoding="async">
                <div v-else class="c-mosaic-empty"></div>
                <div class="c-mosaic-overlay">
                  <div class="c-mosaic-title">{{ b.name }}</div>
                  <div class="c-mosaic-author">{{ b.author }}</div>
                </div>
                <span v-if="isInProgress(b)" class="c-mosaic-ip-dot" aria-hidden="true"></span>
              </button>
            </div>

          </Transition>

          <div class="c-foot">
            <div class="c-foot-rule"></div>
            <svg class="c-foot-star" viewBox="0 0 100 100" aria-hidden="true">
              <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="rgba(200,186,140,0.3)"/>
            </svg>
            <div class="c-foot-rule"></div>
          </div>
        </main>

      </div>

      <!-- Mobile FAB -->
      <button
        class="c-fab"
        :class="{ 'c-fab-off': showYears || fabFooterHidden }"
        @click.stop="toggleYears"
        aria-label="Open archive"
      >
        <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true" style="transform:skewX(-8deg)">
          <line x1="0" y1="1"  x2="17" y2="1"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="0" y1="6"  x2="17" y2="6"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="0" y1="11" x2="17" y2="11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="c-trap" :class="showYears ? 'c-trap-on' : ''" @click="closeYears" aria-hidden="true"></div>

      <aside class="c-drawer" :class="showYears ? 'c-drawer-open' : ''" :aria-hidden="!showYears">
        <div class="c-drawer-header">
          <div class="c-drawer-title-wrap">
            <div class="c-drawer-accent-bar"></div>
            <span class="c-drawer-title">Archive</span>
          </div>
          <button class="c-drawer-close" @click="closeYears" aria-label="Close">×</button>
        </div>
        <nav class="c-drawer-nav">
          <button
            v-for="(y, i) in sortedYears"
            :key="y.year + '-cd'"
            class="c-year-btn"
            :class="{ 'c-year-btn-active': i === selectedYear }"
            @click="selectYear(i)"
          >
            <div class="c-year-bar"></div>
            <div>
              <div class="c-year-num">{{ y.year }}</div>
              <div class="c-year-ct">{{ y.entries.length }} books</div>
            </div>
          </button>
        </nav>
      </aside>

    </template>

    <div ref="footerSentinel" aria-hidden="true" style="height:0"></div>
    <WebFooter />
  </div>

  <SearchOverlay :entries="allEntries" :open="showSearch" @close="showSearch = false" />
  <BookDetail
    v-if="mosaicBook"
    ref="mosaicDetailRef"
    :book="mosaicBook"
    :in-progress="isInProgress(mosaicBook)"
    @close="mosaicBook = null"
  />
  <BookDetail
    v-if="cBook"
    ref="cDetailRef"
    :book="cBook"
    :in-progress="isInProgress(cBook)"
    @close="cBook = null"
  />
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────── */
.root {
  min-height: calc(100vh + 64px);
  display: flex;
  flex-direction: column;
}

/* ── Shell ─────────────────────────────────────────────── */
.shell {
  flex: 1;
  display: flex;
  gap: 0;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  padding-top: 4.5rem;
}
@media (min-width: 640px) { .shell { padding-top: 5rem; } }

/* ── Sidebar ────────────────────────────────────────────── */
.sidebar {
  display: none;
  width: 10rem;
  flex-shrink: 0;
  padding: 2.5rem 0.75rem 2rem 0.75rem;
  border-right: 1px solid #1d1b10;
  background: #131108;
  align-self: stretch;
}
@media (min-width: 1024px) { .sidebar { display: block; } }

.year-nav {
  position: sticky;
  top: 5.5rem;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Main ───────────────────────────────────────────────── */
.main {
  flex: 1;
  min-width: 0;
  padding: 0 1.25rem 5rem;
}
@media (min-width: 640px)  { .main { padding: 0 1.75rem 4rem; } }
@media (min-width: 1024px) { .main { padding: 0 2.5rem 4rem 2rem; } }

/* ── Year section ───────────────────────────────────────── */
.year-section { padding-top: 1.25rem; }
@media (min-width: 640px) { .year-section { padding-top: 2rem; } }

.year-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #2a2618;
  margin-bottom: 0;
}

.year-head-left {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.year-num {
  font-size: clamp(2.75rem, 7vw, 5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
  color: #c8ba8c;
  display: inline-flex;
}

.yn-c {
  display: inline-block;
  animation: yn-in 420ms cubic-bezier(0.2, 0, 0, 1) both;
  animation-delay: calc(var(--ci, 0) * 55ms);
}
@keyframes yn-in {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

.year-count {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #3c3924;
}

.book-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* ── View toggle ────────────────────────────────────────── */
.view-toggle {
  display: flex;
  gap: 2px;
  background: #1a1812;
  border: 1px solid #2a2618;
  border-radius: 7px;
  padding: 3px;
}

.vt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #40392a;
  cursor: pointer;
  transition: color 140ms, background 140ms;
}
.vt-btn:hover { color: #7a8c58; }
.vt-active { background: #252110 !important; color: #c8ba8c !important; }

/* ── Mosaic / shelf ─────────────────────────────────────── */
.mosaic {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px;
  padding-top: 1.25rem;
}
@media (min-width: 640px) { .mosaic { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; } }

.mosaic-cover {
  position: relative;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 5px;
  overflow: hidden;
  aspect-ratio: 2 / 3;
  opacity: 0;
  transform: scale(0.94);
  background: linear-gradient(90deg, #181610 0%, #26220e 50%, #181610 100%);
  background-size: 300% 100%;
  animation:
    mosaic-in 280ms ease both calc(var(--mi, 0) * 22ms),
    cover-shimmer 1.6s ease-in-out infinite;
}
@keyframes cover-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
@keyframes mosaic-in {
  to { opacity: 1; transform: scale(1); }
}

.mosaic-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 5px;
  transition: transform 280ms ease, filter 280ms ease;
}
.mosaic-empty {
  width: 100%;
  height: 100%;
}

.mosaic-cover:hover .mosaic-img { transform: scale(1.05); filter: brightness(1.08); }

.mosaic-title {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  padding: 6px 6px 7px;
  font-size: 8.5px;
  font-weight: 600;
  color: #e0d4b4;
  line-height: 1.3;
  background: linear-gradient(to top, rgba(12,10,6,0.85) 0%, transparent 60%);
  border-radius: 5px;
  opacity: 0;
  transition: opacity 180ms ease;
  text-align: left;
}
.mosaic-cover:hover .mosaic-title { opacity: 1; }
@media (hover: none) { .mosaic-title { opacity: 1; } }

.mosaic-ip { outline: 1.5px solid rgba(122, 140, 88, 0.45); outline-offset: -1.5px; }

.mosaic-ip-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7a8c58;
  animation: ip-pulse 2.4s ease-in-out infinite;
}
@keyframes ip-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(122, 140, 88, 0.6); }
  50%       { box-shadow: 0 0 0 4px rgba(122, 140, 88, 0); }
}

/* ── Year switch transitions ────────────────────────────── */
/* book list / mosaic cross-fade */
.ys-list-leave-from  { opacity: 1; }
.ys-list-leave-active { transition: opacity 120ms ease; }
.ys-list-leave-to    { opacity: 0; }
.ys-list-enter-from  { opacity: 0; }
.ys-list-enter-active { transition: opacity 220ms ease; transition-delay: 40ms; }
.ys-list-enter-to    { opacity: 1; }

.year-count-num { font-variant-numeric: tabular-nums; }

/* ── FAB ────────────────────────────────────────────────── */
.fab {
  position: fixed;
  right: 1rem; bottom: 1.5rem;
  z-index: 80;
  display: flex; align-items: center; justify-content: center;
  width: 42px; height: 42px;
  border-radius: 11px;
  border: 1px solid #2a2618;
  background: #1c1a12;
  color: #7a8c58;
  cursor: pointer;
  transition: opacity 180ms, transform 180ms;
}
.fab:hover { border-color: #3a3620; }
.fab-off { opacity: 0; transform: scale(0.85); pointer-events: none; }
@media (min-width: 1024px) { .fab { display: none; } }

/* ── Click trap ─────────────────────────────────────────── */
.trap {
  position: fixed; inset: 0; z-index: 60;
  pointer-events: none;
  background: rgba(8, 7, 4, 0);
  transition: background 260ms ease;
}
.trap-on {
  pointer-events: auto;
  background: rgba(8, 7, 4, 0.55);
}

/* ── Drawer ─────────────────────────────────────────────── */
.drawer {
  position: fixed;
  right: 0; top: env(safe-area-inset-top, 0); bottom: 0;
  z-index: 70;
  width: 16rem;
  background: #181610;
  border-left: 1px solid #252210;
  box-shadow: -12px 0 40px rgba(0,0,0,0.6);
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.32, 0, 0.15, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.drawer-open { transform: translateX(0); }

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1rem 1rem;
  border-bottom: 1px solid #222016;
  flex-shrink: 0;
}

.drawer-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #4a4630;
}

.drawer-close {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #2a2618; border-radius: 7px;
  background: transparent; color: #5a5440; font-size: 1rem;
  cursor: pointer;
  transition: background 130ms, color 130ms, border-color 130ms;
}
.drawer-close:hover { background: #222016; color: #9a8c6c; border-color: #3a3620; }

.drawer-nav {
  padding: 0.75rem 0.75rem 2rem;
  overflow-y: auto;
  flex: 1;
}


/* ── PIN overlay ─────────────────────────────────────────── */
.h-pin-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(6px);
}

.h-pin-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
}

.h-pin-label {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.5em;
  color: rgba(200,186,140,0.55);
  text-transform: uppercase;
}

.h-pin-dots { display: flex; gap: 0.75rem; }

.h-pin-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1.5px solid rgba(200,186,140,0.3);
  transition: background 150ms, border-color 150ms;
}
.h-pin-dot--on  { background: #c8ba8c; border-color: #c8ba8c; }
.h-pin-dot--err { border-color: #e84545; }
.h-pin-dot--on.h-pin-dot--err { background: #e84545; border-color: #e84545; }

.h-pin-err {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.5rem;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #e84545;
}

.h-pin-fade-enter-active, .h-pin-fade-leave-active { transition: opacity 180ms ease; }
.h-pin-fade-enter-from, .h-pin-fade-leave-to { opacity: 0; }

/* ── Constructivist shell ────────────────────────────────── */
.c-corner-rule {
  position: fixed;
  top: 2rem;
  right: 0;
  width: 24%;
  height: 1px;
  background: rgba(200,186,140,0.18);
  transform: rotate(-2deg);
  transform-origin: right;
  pointer-events: none;
  z-index: 0;
}

.c-shell {
  flex: 1;
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
  padding-top: 4.5rem;
  min-height: calc(100vh - 4.5rem);
}
@media (min-width: 640px) { .c-shell { padding-top: 5rem; } }

/* ── Sidebar ─────────────────────────────────────────────── */
.c-sidebar {
  width: 9.5rem;
  flex-shrink: 0;
  border-right: 1px solid #1d1b10;
  background: #131108;
  padding: 2rem 0 2rem;
  display: none;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: calc(100vh - 4.5rem);
  overflow: hidden;
}
@media (min-width: 1024px) { .c-sidebar { display: flex; } }

.c-sidebar-eyebrow {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.48rem;
  font-weight: 700;
  letter-spacing: 0.5em;
  color: #3c3924;
  text-transform: uppercase;
  padding: 0 1rem 1rem;
  border-bottom: 1px solid #1d1b10;
  margin-bottom: 0.5rem;
}

.c-year-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  flex: 1;
  padding-right: 0.6rem;
}

.c-year-btn {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 1rem 0.6rem 0.9rem;
  cursor: pointer;
  border: none;
  background: none;
  text-align: left;
  clip-path: polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%);
  transition: background 120ms;
}
.c-year-btn:hover { background: #1a1812; }
.c-year-btn-active { background: rgba(200,186,140,0.1); }

.c-year-bar {
  width: 3px;
  align-self: stretch;
  background: rgba(200,186,140,0.15);
  flex-shrink: 0;
  transition: background 120ms;
}
.c-year-btn-active .c-year-bar { background: #c8ba8c; }

.c-year-num {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: #40392a;
  line-height: 1;
  transition: color 120ms;
}
.c-year-btn-active .c-year-num { color: #c8ba8c; }
.c-year-btn:hover:not(.c-year-btn-active) .c-year-num { color: #6e634a; }

.c-year-ct {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: #2e2b1e;
  transition: color 120ms;
}
.c-year-btn-active .c-year-ct { color: rgba(200,186,140,0.45); }

/* ── Main ────────────────────────────────────────────────── */
.c-main {
  flex: 1;
  min-width: 0;
  padding: 0 1.25rem 5rem;
  position: relative;
  overflow: hidden;
  padding-top: 1.25rem;
}
@media (min-width: 640px)  { .c-main { padding: 2rem 1.75rem 4rem; } }
@media (min-width: 1024px) { .c-main { padding: 2rem 2.5rem 4rem 2rem; } }

.c-ghost-year {
  position: absolute;
  top: -1rem;
  right: -0.5rem;
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: clamp(9rem, 20vw, 16rem);
  line-height: 0.82;
  color: rgba(200,186,140,0.028);
  pointer-events: none;
  user-select: none;
  z-index: 0;
  letter-spacing: -0.02em;
}

/* ── Year header ─────────────────────────────────────────── */
.c-year-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #2a2618;
  margin-bottom: 0;
}

.c-year-head-left { display: flex; align-items: baseline; gap: 1rem; }

.c-year-display {
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: clamp(3rem, 8vw, 6rem);
  line-height: 0.86;
  color: #c8ba8c;
  letter-spacing: 0.03em;
}

.c-book-count {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.32em;
  color: #3c3924;
  text-transform: uppercase;
  padding-bottom: 0.25rem;
}

.c-view-toggle {
  display: flex;
  gap: 2px;
  background: #1a1812;
  border: 1px solid #2a2618;
  border-radius: 7px;
  padding: 3px;
  margin-bottom: 0.15rem;
}

.c-vt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #40392a;
  cursor: pointer;
  transition: color 140ms, background 140ms;
}
.c-vt-btn:hover { color: #7a8c58; }
.c-vt-active { background: #252110 !important; color: #c8ba8c !important; }

/* ── Slash dividers ──────────────────────────────────────── */
.c-slash {
  position: relative;
  z-index: 1;
  height: 2.2rem;
  margin: 0.65rem 0;
  overflow: visible;
}

.c-slash-line {
  position: absolute;
  left: -3%;
  width: 106%;
  height: 1px;
  background: rgba(200,186,140,0.2);
  top: 50%;
  transform: rotate(-1.8deg);
}

.c-slash-tag {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.45em;
  color: #3c3924;
  background: #0d0b08;
  padding: 0 0.75rem;
  text-transform: uppercase;
  white-space: nowrap;
}

/* ── Book list ───────────────────────────────────────────── */
.c-list-view { position: relative; z-index: 1; }

.c-book-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: #211f15;
}

.c-book {
  position: relative;
  background: #0d0b08;
  cursor: pointer;
  transition: background 140ms;
}
.c-book:hover { background: rgba(255,245,215,0.028); }

.c-book-ghost {
  position: absolute;
  right: 1.5rem;
  top: 50%;
  translate: 0 -50%;
  font-family: 'Bebas Neue', Arial, sans-serif;
  font-size: 4.5rem;
  line-height: 1;
  color: rgba(200,186,140,0.028);
  pointer-events: none;
  user-select: none;
}

.c-book-inner {
  display: flex;
  align-items: center;
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
}

.c-book-accent {
  width: 3px;
  align-self: stretch;
  flex-shrink: 0;
  background: rgba(200,186,140,0.18);
  transition: background 140ms;
}
.c-book:hover .c-book-accent    { background: rgba(200,186,140,0.45); }
.c-book-ip  .c-book-accent      { background: rgba(122,140,88,0.4); animation: c-bar-pulse 2.4s ease-in-out infinite; }
.c-book-ip:hover .c-book-accent { background: #7a8c58; }
@keyframes c-bar-pulse {
  0%,100% { background: rgba(122,140,88,0.4); }
  50%      { background: rgba(122,140,88,0.7); }
}

.c-book-cover {
  width: 46px; height: 68px;
  object-fit: contain;
  flex-shrink: 0;
  margin: 0.7rem 0.9rem 0.7rem 0.75rem;
  display: block;
  background: #1a1812;
}

.c-book-cover-skel {
  width: 46px; height: 68px;
  flex-shrink: 0;
  margin: 0.7rem 0.9rem 0.7rem 0.75rem;
  background: linear-gradient(90deg, #181610 0%, #26220e 50%, #181610 100%);
  background-size: 300% 100%;
  animation: c-shimmer 1.6s ease-in-out infinite;
}
@keyframes c-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.c-book-body {
  flex: 1;
  min-width: 0;
  padding: 0.8rem 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.c-book-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #e0d4b4;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
@media (min-width: 640px) { .c-book-title { font-size: 1.05rem; } }

.c-book-author {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: #728a50;
}

.c-book-tags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }

.c-book-tag {
  font-size: 9.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  background: #1c2010;
  color: #607840;
  border: 1px solid #2a3018;
  letter-spacing: 0.02em;
}

.c-book-note {
  font-size: 0.7rem;
  color: #524e3c;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 1px;
}

.c-book-meta {
  flex-shrink: 0;
  padding: 0 1.25rem 0 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.c-book-date {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #a87e3c;
  white-space: nowrap;
}

.c-book-ip-label {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #7a8c58;
  text-transform: uppercase;
}

.c-book-ip-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #7a8c58;
  animation: c-ip-pulse 2.4s ease-in-out infinite;
}
@keyframes c-ip-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(122,140,88,0.55); }
  50%      { box-shadow: 0 0 0 4px rgba(122,140,88,0); }
}

/* ── Mosaic ──────────────────────────────────────────────── */
.c-mosaic {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px;
  padding-top: 1.25rem;
}
@media (min-width: 640px) { .c-mosaic { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; } }

.c-mosaic-item {
  position: relative;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 5px;
  overflow: hidden;
  aspect-ratio: 2/3;
  background: linear-gradient(90deg, #181610 0%, #26220e 50%, #181610 100%);
  background-size: 300% 100%;
  animation: c-shimmer 1.6s ease-in-out infinite calc(var(--mi, 0) * 22ms);
  transition: transform 200ms ease, filter 200ms ease;
}
.c-mosaic-item:hover { transform: scale(1.04); filter: brightness(1.08); }
.c-mosaic-item-ip { outline: 1.5px solid rgba(122,140,88,0.45); outline-offset: -1.5px; }

.c-mosaic-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.c-mosaic-empty { width: 100%; height: 100%; }

.c-mosaic-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 6px 7px 8px;
  background: linear-gradient(to top, rgba(12,10,6,0.88) 0%, transparent 58%);
  border-radius: 5px;
  opacity: 0;
  transition: opacity 160ms;
}
.c-mosaic-item:hover .c-mosaic-overlay { opacity: 1; }
@media (hover: none) { .c-mosaic-overlay { opacity: 1; } }

.c-mosaic-title { font-size: 8.5px; font-weight: 600; color: #e0d4b4; line-height: 1.3; }
.c-mosaic-author { font-size: 7.5px; color: #524e3c; margin-top: 1px; }

.c-mosaic-ip-dot {
  position: absolute;
  top: 5px; right: 5px;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #7a8c58;
  animation: c-ip-pulse 2.4s ease-in-out infinite;
}

/* ── Footer ──────────────────────────────────────────────── */
.c-foot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 2.5rem;
}
.c-foot-rule { flex: 1; height: 1px; background: #2a2618; }
.c-foot-star { width: 8px; height: 8px; flex-shrink: 0; }

/* ── Constructivist mobile FAB ───────────────────────────── */
.c-fab {
  position: fixed;
  right: 1rem;
  bottom: 1.5rem;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 38px;
  border: none;
  background: #1c1a12;
  color: #7a8c58;
  cursor: pointer;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  transition: opacity 180ms, transform 180ms, background 140ms, color 140ms;
}
.c-fab:hover { background: #252110; color: #c8ba8c; }
.c-fab-off { opacity: 0; transform: scale(0.85); pointer-events: none; }
@media (min-width: 1024px) { .c-fab { display: none; } }

/* ── Constructivist trap ─────────────────────────────────── */
.c-trap {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
  background: rgba(8,7,4,0);
  transition: background 260ms ease;
}
.c-trap-on { pointer-events: auto; background: rgba(8,7,4,0.6); }

/* ── Constructivist drawer ───────────────────────────────── */
.c-drawer {
  position: fixed;
  right: 0;
  top: env(safe-area-inset-top, 0);
  bottom: 0;
  z-index: 70;
  width: 16rem;
  background: #131108;
  border-left: 2px solid rgba(200,186,140,0.1);
  box-shadow: -12px 0 40px rgba(0,0,0,0.65);
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.32,0,0.15,1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.c-drawer-open { transform: translateX(0); }

.c-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.1rem 1rem 1rem;
  border-bottom: 1px solid #1d1b10;
  flex-shrink: 0;
}

.c-drawer-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.c-drawer-accent-bar {
  width: 3px;
  height: 1rem;
  background: #c8ba8c;
  flex-shrink: 0;
}

.c-drawer-title {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #c8ba8c;
}

.c-drawer-close {
  width: 28px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #2a2618;
  background: transparent;
  color: #5a5440;
  font-size: 1rem;
  cursor: pointer;
  clip-path: polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%);
  transition: background 130ms, color 130ms;
}
.c-drawer-close:hover { background: #1a1812; color: #c8ba8c; }

.c-drawer-nav {
  padding: 0.5rem 0.75rem 2rem 0;
  overflow-y: auto;
  flex: 1;
}

.c-drawer-nav .c-year-btn {
  width: 100%;
  padding: 0.9rem 1.5rem 0.9rem 1rem;
  clip-path: polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%);
}
.c-drawer-nav .c-year-btn-active {
  background: rgba(200,186,140,0.1);
}
</style>
