<script setup>
import { RouterLink } from "vue-router";
import { ref, onMounted, onUnmounted } from "vue";

const visible = ref(true);
let lastY = 0;
let ticking = false;

function onScroll(){
  const currentY = window.scrollY || 0;
  if (!ticking) {
    window.requestAnimationFrame(() => {
      if (currentY > lastY + 8) { visible.value = false; }
      else if (currentY < lastY - 8) { visible.value = true; }
      lastY = currentY;
      ticking = false;
    });
    ticking = true;
  }
}

onMounted(() => {
  lastY = window.scrollY || 0;
  window.addEventListener('scroll', onScroll, { passive: true });
});
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
});
</script>

<template>
  <header
    :class="[
      'fixed left-0 top-0 z-50 w-screen bg-[#282828] border-b border-white/5 shadow-md py-4 sm:py-6 transform transition-transform duration-700 ease-out',
      visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
    ]"
    aria-hidden="false"
  >
    <div class="max-w-[1400px] mx-auto flex items-center justify-between px-4 sm:px-6">
      <RouterLink to="/" class="font-extrabold tracking-wide text-[#83a598] text-lg sm:text-xl">aidashpy</RouterLink>
      <nav class="hidden sm:flex gap-3">
        <RouterLink to="/links" class="px-3 py-2 rounded text-[#ebdbb2] font-semibold hover:bg-white/3">Links</RouterLink>
      </nav>
    </div>
  </header>
</template>
