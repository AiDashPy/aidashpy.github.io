<script setup>
import { ref, computed, watch, onMounted } from "vue";
import BookEntry from "../components/BookEntry.vue";
import WebHeader from "../components/WebHeader.vue";
import WebFooter from "../components/WebFooter.vue";
import YearBadge from "../components/YearBadge.vue";
import { yearlyBookEntries } from "../javascript/yearlyBookData";

const selectedYear = ref(0);
const showYears = ref(false);

/* pagination state */
const pageSize = ref(20);
const currentPage = ref(1);

/* how many images to load with high priority per page */
const priorityCount = 6;

function parseDateFromBook(b) {
  if (!b) return 0;
  if (b.date) {
    const t = Date.parse(b.date);
    if (!Number.isNaN(t)) return t;
  }
  if (b.finish) {
    const t = Date.parse(b.finish.replace(/^Finished\s*/, ""));
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/* produce a new array where each year's entries are sorted by descending date */
const sortedYears = computed(() =>
  yearlyBookEntries.map((y) => ({
    ...y,
    entries: [...(y.entries || [])].sort((a, b) => parseDateFromBook(b) - parseDateFromBook(a)),
  }))
);

/* --- ADDED: entriesForSelected computed (was missing) --- */
const entriesForSelected = computed(() => {
  const s = sortedYears.value[selectedYear.value];
  return s ? (s.entries || []) : [];
});

/* pagination helpers */
const totalPages = computed(() => Math.max(1, Math.ceil(entriesForSelected.value.length / pageSize.value)));

const paginatedEntries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return entriesForSelected.value.slice(start, start + pageSize.value);
});

/* prefetch helper: create Image objects for the current page to warm cache;
   also create <link rel="preload"> for the first few images to encourage priority */
function prefetchImages(entries = []) {
  if (!entries || !entries.length) return;
  // preload first N via link rel=preload
  entries.forEach((e, i) => {
    if (!e || !e.img) return;
    // create Image to warm browser cache
    const img = new Image();
    img.src = e.img;
    // first few: add preload hint
    if (i < priorityCount && typeof document !== "undefined") {
      try {
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = "image";
        link.href = e.img;
        link.onload = () => { link.remove(); };
        link.onerror = () => { link.remove(); };
        document.head.appendChild(link);
      } catch (err) {
        // ignore
      }
    }
  });
}

/* prefetch when paginatedEntries change or on mount */
watch(
  () => paginatedEntries.value,
  (v) => prefetchImages(v),
  { immediate: true }
);

onMounted(() => {
  prefetchImages(paginatedEntries.value);
});

/* update pagination helpers to keep prefetch in sync */
function goToPage(n){
  if(n < 1) n = 1;
  if(n > totalPages.value) n = totalPages.value;
  currentPage.value = n;
  scrollToTop();
  // prefetch after updating currentPage
  // next tick not necessary here; computed paginatedEntries will update and trigger watch
}
function nextPage(){
  if(currentPage.value < totalPages.value) currentPage.value++;
  scrollToTop();
}
function prevPage(){
  if(currentPage.value > 1) currentPage.value--;
  scrollToTop();
}

function formatYear(raw) {
  const s = String(raw).match(/\d{4}/);
  return s ? s[0] : String(raw).slice(0,4);
}

function selectYear(i){
  selectedYear.value = i;
  window.scrollTo({ top: 0, behavior: "smooth" });
  showYears.value = false; // close panel on selection (mobile)
}
function toggleYears(){
  showYears.value = !showYears.value;
}
function closeYears(){
  showYears.value = false;
}
</script>

<template>
  <div class="home-root">
    <WebHeader />

    <!-- tighter gutters on small/medium screens -->
    <div class="home-shell flex gap-2 sm:gap-3 px-1 sm:px-2 md:px-3">
      <!-- restored sidebar and main-grid -->
      <aside class="left-panel hidden lg:flex flex-col items-start gap-4 w-40 p-4 rounded-lg bg-gradient-to-b from-[#282828] to-[#1d2021] border border-white/5 shadow-xl min-h-screen">
        <div class="text-xs font-extrabold tracking-wide">ARCHIVE</div>
        <div class="w-full space-y-2">
          <YearBadge
            v-for="(y, i) in sortedYears"
            :key="y.year"
            :year="y.year"
            :count="y.entries.length"
            :active="i === selectedYear"
            @select="selectYear(i)"
          />
        </div>
      </aside>

      <main class="main-grid flex-1" ref="mainRef">
        <!-- TransitionGroup animates entries on year switch.
             Use single column below lg (sidebar hidden), two columns at lg+ -->
        <TransitionGroup
          tag="div"
          name="book"
          appear
          class="grid grid-cols-1 lg:grid-cols-2 gap-3 px-0 sm:px-2 md:px-3 items-stretch"
        >
          <BookEntry
            v-for="(b, idx) in paginatedEntries"
            :key="((currentPage-1)*pageSize + idx) + '-' + b.name"
            class="book-item"
            :book="b"
            :priority="idx < priorityCount"
          />
        </TransitionGroup>
      </main>
    </div>

    <!-- floating hamburger (small screens) — no longer v-show; hide via classes while panel open -->
    <button
      :class="[
        'lg:hidden fixed right-4 bottom-4 z-80 w-12 h-12 rounded-lg bg-[#282828] border border-white/5 shadow-lg flex flex-col items-center justify-center gap-0.5 p-2 text-[#ebdbb2] transition-opacity duration-200',
        showYears ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      ]"
      @click.stop="toggleYears"
      :aria-expanded="showYears"
      aria-label="Open years"
    >
      <span class="block w-5 h-0.5 bg-current rounded"></span>
      <span class="block w-5 h-0.5 bg-current rounded mt-1"></span>
      <span class="block w-5 h-0.5 bg-current rounded mt-1"></span>
    </button>

    <!-- overlay (always present; opacity + pointer-events toggled for fade + blocking) -->
    <div
      class="fixed inset-0 z-60 transition-opacity duration-300 bg-black"
      :class="showYears ? 'opacity-50 pointer-events-auto' : 'opacity-0 pointer-events-none'"
      @click="closeYears"
      :aria-hidden="!showYears"
    ></div>

    <!-- slide panel (always in DOM) — full-viewport vertical span, scrollable -->
    <aside
      class="slide-years fixed right-0 top-0 bottom-0 z-70 bg-[#282828] w-80 transform transition-transform duration-300 overflow-auto"
      :class="showYears ? 'translate-x-0' : 'translate-x-full'"
      :aria-hidden="!showYears"
    >
       <!-- close button (top-right) -->
       <button class="absolute top-3 right-3 text-2xl text-[#ebdbb2] bg-transparent border-0" @click="closeYears" aria-label="Close years">×</button>

       <!-- years list moved below the close button with top padding -->
       <div class="slide-years-list pt-12 p-4 space-y-2">
         <YearBadge
           v-for="(y, i) in sortedYears"
           :key="y.year + '-slide'"
           :year="y.year"
           :count="y.entries.length"
           :active="i === selectedYear"
           @select="selectYear(i)"
         />
       </div>
     </aside>

    <div v-if="entriesForSelected.length > pageSize" class="mt-6 mb-4 flex items-center justify-center gap-3">
      <!-- ...existing pagination UI ... -->
    </div>

    <WebFooter />
  </div>
</template>

<style scoped>
/* fade-only enter/leave for book items (no restacking) */
.book-item.book-enter-from,
.book-item.book-leave-to {
  opacity: 0;
}
.book-item.book-enter-active,
.book-item.book-leave-active {
  transition: opacity 320ms cubic-bezier(.2,.9,.25,1);
}
.book-item.book-enter-to,
.book-item.book-leave-from {
  opacity: 1;
}

/* --- new: apply same fade when items appear on initial mount --- */
.book-item.book-appear-from {
  opacity: 0;
}
.book-item.book-appear-active {
  transition: opacity 320ms cubic-bezier(.2,.9,.25,1);
}
.book-item.book-appear-to {
  opacity: 1;
}

/* reduce layout churn hint */
.book-item { will-change: opacity; }

/* remove previous transform/stacking/stagger rules (no reflow animation) */
</style>
