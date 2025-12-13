<script setup>
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

/* new: set placeholder when image fails to load */
function onImgError(e) {
  const img = e?.target;
  if (!img) return;
  if (img.dataset._placeholderApplied) return;
  img.src = placeholderSvg;
  img.dataset._placeholderApplied = '1';
}
</script>

<template>
  <article class="relative overflow-hidden rounded-lg bg-[#2f2b2a] border-l-4 border-[#b8bb26]">
    <div class="flex gap-4 p-4">
      <!-- cover (left) — transparent container, allow shadow to escape; pop-out via Tailwind -->
      <div
        class="flex-none w-24 sm:w-28 md:w-36 h-36 rounded-md overflow-visible shrink-0 cursor-pointer relative z-0 bg-transparent"
        role="link"
        tabindex="0"
        title="Search this book on Goodreads"
        @click="openGoodreads(props.book)"
        @keydown.enter="openGoodreads(props.book)"
      >
        <img
          :src="book.img"
          :alt="book.name"
          class="w-full h-full object-contain transition-transform duration-200 ease-out hover:scale-105 relative z-20"
          @error="onImgError"
        />
      </div>

      <!-- content (right) -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- title + author (top) -->
        <div class="truncate">
          <h3 class="text-[#83a598] font-extrabold text-lg leading-tight truncate">{{ book.name }}</h3>
          <div class="text-[#a89984] text-sm font-semibold mt-1 truncate">{{ book.author }}</div>
          <div v-if="book.tags && book.tags.length" class="mt-2 text-xs text-[#cfc9db] opacity-80 truncate">
            {{ (book.tags || []).slice(0,3).join(' • ') }}
          </div>
        </div>

        <!-- note/body (middle) -->
        <div class="mt-3 text-[#cfc9db] text-sm leading-relaxed line-clamp-3 flex-1">
          <p v-if="book.note" class="w-full truncate">{{ book.note }}</p>
        </div>

        <!-- finish/pages aligned left (bottom) -->
        <div class="mt-4 flex items-center justify-start gap-4 text-sm">
          <div class="text-[#b8bb26] font-bold">{{ book.finish }}</div>
          <div v-if="book.pages" class="text-[#a89984] font-semibold">{{ book.pages }}p</div>
        </div>
      </div>
    </div>
  </article>
</template>
