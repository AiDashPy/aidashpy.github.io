<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
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

function onKeydown(e) {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape") { showSearch.value = false; return; }
  if (e.key === "/" && !showSearch.value) { e.preventDefault(); showSearch.value = true; return; }
  if (showSearch.value) return;
  if (e.key.length !== 1) return;
  keyBuffer += e.key.toLowerCase();
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => { keyBuffer = ""; }, 1000);
  if (keyBuffer.endsWith("admin")) { keyBuffer = ""; clearTimeout(keyTimer); router.push("/admin"); }
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
watch(viewMode, (v) => localStorage.setItem("bookViewMode", v));
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
  const toCount   = finishedEntries.value.length;
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
  NProgress.start();
  try {
    const workerUrl = import.meta.env.VITE_WORKER_URL ?? "https://aidashpy-api.adiashpy.workers.dev";
    const res = await fetch(`${workerUrl}/books.json`);
    books.value = await res.json();
  } catch {}
  NProgress.done();
  displayYear.value  = currentYear.value;
  displayCount.value = finishedEntries.value.length;
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
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  clearTimeout(keyTimer);
  if (countTimer)     clearInterval(countTimer);
  if (countBookTimer) clearInterval(countBookTimer);
  footerObs?.disconnect();
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
});
</script>

<template>
  <div class="root">
    <WebHeader />

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
                  @click="viewMode = 'list'"
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
                  @click="viewMode = 'mosaic'"
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
              <ol v-if="viewMode === 'list'" :key="'list-' + selectedYear" class="book-list">
                <BookEntry
                  v-for="(b, idx) in listEntries"
                  :key="selectedYear + '-' + b.name"
                  :book="b"
                  :index="isInProgress(b) ? 0 : finishedEntries.length - (idx - nowReadingForYear.length)"
                  :in-progress="isInProgress(b)"
                  :priority="idx < priorityCount"
                  :style="{ '--i': idx }"
                />
              </ol>
              <div v-else :key="'grid-' + selectedYear" class="mosaic">
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
</style>
