<script setup>
import { ref, computed } from "vue";
import BookEntry from "../components/BookEntry.vue";
import WebHeader from "../components/WebHeader.vue";
import WebFooter from "../components/WebFooter.vue";
import YearBadge from "../components/YearBadge.vue";
import { yearlyBookEntries } from "../javascript/yearlyBookData";

const selectedYear = ref(0);
const showYears = ref(false);

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

    <div class="home-shell flex gap-6">
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

      <main class="main-grid flex-1">
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 px-4">
          <BookEntry
            v-for="(b, idx) in sortedYears[selectedYear].entries"
            :key="b.name + idx"
            :book="b"
          />
        </div>
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

    <WebFooter />
  </div>
</template>
