<script setup>
import { ref } from "vue";

const props = defineProps({
  book: { type: Object, required: true },
  priority: { type: Boolean, default: false }
});

/* placeholder SVG (small, encoded) used when image fails to load */
const placeholderSvg = `data:image/svg+xml;utf8,` + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='360' viewBox='0 0 240 360'>
    <rect width='100%' height='100%' fill='#2b2b2b'/>
    <g fill='#a89984' font-family='sans-serif' font-size='18' text-anchor='middle'>
      <text x='50%' y='46%'>No image</text>
      <text x='50%' y='58%' font-size='12'>available</text>
    </g>
  </svg>`
);

const imgLoaded = ref(false);

function onImgLoad() {
  imgLoaded.value = true;
}

function onImgError(e) {
  const img = e?.target;
  if (!img) return;
  if (img.dataset._placeholderApplied) return;
  img.src = placeholderSvg;
  img.dataset._placeholderApplied = '1';
  imgLoaded.value = true;
}

const openGoodreads = (book) => {
  const q = encodeURIComponent(`${book.name || ''} ${book.author || ''}`.trim());
  const url = `https://www.goodreads.com/search?q=${q}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};
</script>

<template>
  <article class="group w-full bg-[#2f2b2a] border border-[#3a3838] rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-200">
    <div class="flex items-stretch gap-3 p-3 sm:p-4">
      <!-- thumbnail frame with XY padding -->
      <div
        role="link"
        tabindex="0"
        @click="openGoodreads(props.book)"
        @keydown.enter="openGoodreads(props.book)"
        class="flex-none w-24 sm:w-28 md:w-32 h-36 rounded-lg bg-[#1f1f1f] p-2 flex items-center justify-center"
        :title="`Search ${props.book.name} on Goodreads`"
      >
        <!-- thumbnail placeholder -->
        <div v-if="!imgLoaded" class="absolute inset-0 rounded-lg overflow-hidden pointer-events-none">
          <div class="w-full h-full bg-gradient-to-br from-[#222] to-[#2b2b2b] animate-pulse opacity-70"></div>
        </div>

        <img
          :src="book.img"
          :alt="book.name"
          :loading="priority ? 'eager' : 'lazy'"
          :importance="priority ? 'high' : 'low'"
          decoding="async"
          width="144" height="144"
          class="relative w-full h-full object-contain rounded-sm transition-opacity duration-300 cursor-pointer"
          :class="imgLoaded ? 'opacity-100' : 'opacity-0'"
          @load="onImgLoad"
          @error="onImgError"
        />
      </div>

      <!-- content -->
      <div class="flex-1 flex flex-col justify-between min-w-0">
        <div>
          <h3 class="text-[#e6f0ef] font-bold text-sm sm:text-base leading-tight truncate">{{ book.name }}</h3>
          <div class="text-[#bfb6a8] text-xs sm:text-sm mt-1 truncate">{{ book.author }}</div>

          <div v-if="book.tags && book.tags.length" class="mt-2 text-xs text-[#a89f93] flex flex-wrap gap-2">
            <span v-for="(t,i) in (book.tags||[]).slice(0,5)" :key="i" class="px-2 py-0.5 bg-[#232222] rounded text-[11px] truncate">{{ t }}</span>
          </div>

          <p v-if="book.note" class="mt-2 text-[#bfb6a8] text-xs sm:text-sm line-clamp-3 leading-relaxed truncate">
            {{ book.note }}
          </p>
        </div>

        <div class="mt-3 flex items-center justify-start gap-3 text-xs sm:text-sm text-[#d1c9be]">
          <div class="flex items-center gap-3">
            <span class="font-semibold text-[#ffd66b]">{{ book.finish }}</span>
            <span v-if="book.pages" class="text-[#bfb6a8]">{{ book.pages }}p</span>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* subtle focus outline for accessibility */
[role="link"]:focus {
  outline: 2px solid rgba(255,214,107,0.18);
  outline-offset: 2px;
  border-radius: 8px;
}
/* ensure the pulse placeholder sits behind the image */
.group img { display: block; }
</style>
