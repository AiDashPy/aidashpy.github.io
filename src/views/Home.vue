<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import BookEntry from "../components/BookEntry.vue";
import WebHeader from "../components/WebHeader.vue";
import WebFooter from "../components/WebFooter.vue";
import YearBadge from "../components/YearBadge.vue";
import { yearlyBookEntries } from "../javascript/yearlyBookData";

const selectedYear = ref(0);
const showYears = ref(false);
const priorityCount = 6;

function parseDateFromBook(b) {
  if (!b) return 0;
  if (b.date) { const t = Date.parse(b.date); if (!Number.isNaN(t)) return t; }
  if (b.finish) { const t = Date.parse(b.finish.replace(/^(?:Finished|Started)\s*/i, "")); if (!Number.isNaN(t)) return t; }
  return 0;
}

const sortedYears = computed(() =>
  yearlyBookEntries.map((y) => ({
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

watch(() => entriesForSelected.value, prefetchImages, { immediate: true });
onMounted(() => prefetchImages(entriesForSelected.value));

function selectYear(i) {
  if (i === selectedYear.value) { showYears.value = false; return; }
  window.scrollTo(0, 0);
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
        <Transition name="ys" mode="out-in">
          <div :key="selectedYear" class="year-section">

            <!-- Year header -->
            <header class="year-head">
              <span class="year-num">{{ currentYear }}</span>
              <span class="year-count">{{ entriesForSelected.length }}&thinsp;books</span>
            </header>

            <!-- Book list -->
            <ol class="book-list">
              <BookEntry
                v-for="(b, idx) in entriesForSelected"
                :key="idx + '-' + b.name"
                :book="b"
                :index="idx + 1"
                :priority="idx < priorityCount"
                :style="{ '--i': idx }"
              />
            </ol>

          </div>
        </Transition>
      </main>
    </div>

    <!-- Mobile FAB -->
    <button class="fab" :class="showYears ? 'fab-off' : ''" @click.stop="toggleYears" aria-label="Open archive">
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true">
        <line x1="0" y1="1"   x2="17" y2="1"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="0" y1="6"   x2="17" y2="6"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="0" y1="11"  x2="17" y2="11"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>

    <div class="trap" :class="showYears ? 'trap-on' : ''" @click="closeYears" aria-hidden="true"></div>

    <aside class="drawer" :class="showYears ? 'drawer-open' : ''" :aria-hidden="!showYears">
      <button class="drawer-close" @click="closeYears" aria-label="Close">×</button>
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

    <WebFooter />
  </div>
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────── */
.root {
  min-height: calc(100vh + 64px);
  display: flex;
  flex-direction: column;
  background: #16140d;
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
  padding: 2.5rem 0 2rem 1.5rem;
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
  padding: 0 1.25rem 4rem;
}
@media (min-width: 640px)  { .main { padding: 0 1.75rem 4rem; } }
@media (min-width: 1024px) { .main { padding: 0 2.5rem 4rem 2rem; } }

/* ── Year section ───────────────────────────────────────── */
.year-section { padding-top: 2rem; }

.year-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #2a2618;
  margin-bottom: 0;
}

.year-num {
  font-size: clamp(2.75rem, 7vw, 5rem);
  font-weight: 900;
  letter-spacing: -0.04em;
  line-height: 1;
  color: #c8ba8c;
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

/* ── Year switch transition ─────────────────────────────── */
.ys-leave-from  { opacity: 1; }
.ys-leave-active { transition: opacity 140ms ease; }
.ys-leave-to    { opacity: 0; }
.ys-enter-from  { opacity: 0; }
.ys-enter-active { transition: opacity 240ms ease; transition-delay: 30ms; }
.ys-enter-to    { opacity: 1; }

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
.trap { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
.trap-on { pointer-events: auto; }

/* ── Drawer ─────────────────────────────────────────────── */
.drawer {
  position: fixed;
  right: 0; top: env(safe-area-inset-top, 0); bottom: 0;
  z-index: 70;
  width: 14rem;
  background: #1c1a12;
  border-left: 1px solid #2a2618;
  box-shadow: -6px 0 24px rgba(0,0,0,0.5);
  transform: translateX(100%);
  transition: transform 260ms cubic-bezier(0.4,0,0.2,1);
  overflow-y: auto;
}
.drawer-open { transform: translateX(0); }

.drawer-close {
  position: absolute; top: 1rem; right: 1rem;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #2a2618; border-radius: 7px;
  background: transparent; color: #7a8c58; font-size: 1.1rem;
  cursor: pointer;
}
.drawer-close:hover { background: #222016; }

.drawer-nav { padding: 3.5rem 1rem 1.5rem; }
</style>
