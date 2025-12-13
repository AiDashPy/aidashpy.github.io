<script setup>
import { ref } from "vue";

const props = defineProps({
  book: { type: Object, required: true }
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

const openGoodreads = (book) => {
  const q = encodeURIComponent(`${book.name || ''} ${book.author || ''}`.trim());
  const url = `https://www.goodreads.com/search?q=${q}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

/* image placeholder + loaded state for blur-up */
const imgLoaded = ref(false);

function onImgLoad(e){
  imgLoaded.value = true;
}

/* set placeholder when image fails to load */
function onImgError(e) {
  const img = e?.target;
  if (!img) return;
  if (img.dataset._placeholderApplied) return;
  img.src = placeholderSvg;
  img.dataset._placeholderApplied = '1';
  imgLoaded.value = true;
}
</script>

<template>
  <article class="relative overflow-hidden rounded-lg bg-[#2f2b2a] border-l-4 border-[#b8bb26]">
    <div class="flex gap-4 p-4">
      <!-- cover (left) — no background, allow shadow to escape; blur-up until loaded -->
      <div
        class="flex-none w-20 sm:w-28 md:w-36 h-36 rounded-md overflow-visible shrink-0 cursor-pointer relative z-0 bg-transparent"
        role="link"
        tabindex="0"
        title="Search this book on Goodreads"
        @click="openGoodreads(props.book)"
        @keydown.enter="openGoodreads(props.book)"
      >
        <img
          :src="book.img"
          :alt="book.name"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-contain transition-all duration-300"
          :class="imgLoaded ? 'filter-none scale-100' : 'blur-sm scale-105'"
          @load="onImgLoad"
          @error="onImgError"
        />
      </div>

      <!-- content (right) -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- title + author (top) -->
        <div class="truncate">
          <h3 class="text-[#83a598] font-extrabold text-base leading-tight truncate">{{ book.name }}</h3>
          <div class="text-[#a89984] font-semibold text-sm mt-1 truncate">{{ book.author }}</div>
        </div>

        <!-- note/body (middle) -->
        <div class="mt-3 text-[#a89984] text-sm leading-relaxed line-clamp-3 flex-1">
          <p v-if="book.note" class="w-full truncate">{{ book.note }}</p>
        </div>

        <!-- finish/pages aligned left (bottom) -->
        <div class="mt-4 flex items-center justify-start gap-4 text-sm">
          <div class="text-[#b8bb26] font-bold">{{ book.finish }}</div>
          <div v-if="book.pages" class="text-[#a89984] text-sm font-semibold">{{ book.pages }}p</div>
        </div>
      </div>
    </div>
  </article>
</template>
