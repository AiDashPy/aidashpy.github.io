<script setup>
import { RouterLink } from "vue-router";
const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
};
</script>

<template>
  <!-- full-bleed footer in document flow (not fixed) -->
  <footer class="w-full bg-[#1d2021] border-white/5 mt-6">
    <div class="max-w-[1440px] mx-auto px-4 flex items-center justify-center gap-6 py-4">
      <!-- <div class="text-sm font-semibold text-[#ebdbb2]">© curated log</div> -->
      <div class="flex gap-3">
        <a class="text-sm px-3 py-1 rounded bg-white/2 hover:bg-white/5" href="https://www.goodreads.com/review/list/168293432?ref=nav_mybooks" target="_blank" rel="noopener noreferrer">Goodreads</a>
        <RouterLink class="text-sm px-3 py-1 rounded bg-white/2 hover:bg-white/5" to="/links">Links</RouterLink>

        <!-- added: Go to top button -->
        <button
          type="button"
          @click="scrollToTop"
          aria-label="Scroll to top"
          class="text-sm px-3 py-1 rounded bg-white/2 hover:bg-white/5 cursor-pointer"
        >
          ↑ Top
        </button>
      </div>
    </div>
  </footer>
</template>
