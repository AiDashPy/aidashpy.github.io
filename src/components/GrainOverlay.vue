<template>
  <div v-if="url" class="grain" :style="{ backgroundImage: `url(${url})` }" aria-hidden="true" />
</template>

<script setup>
import { ref, onMounted } from "vue";

const url = ref("");

onMounted(() => {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  url.value = c.toDataURL();
});
</script>

<style scoped>
.grain {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
  background-repeat: repeat;
  background-size: 256px 256px;
  opacity: 0.028;
  animation: grain-shift 0.55s steps(1) infinite;
}

@keyframes grain-shift {
  0%   { background-position: 0 0; }
  14%  { background-position: -52px -76px; }
  28%  { background-position: 88px -20px; }
  42%  { background-position: -68px 52px; }
  57%  { background-position: 28px 92px; }
  71%  { background-position: -92px -44px; }
  85%  { background-position: 64px -88px; }
}
</style>
