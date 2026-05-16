<script setup>
import { computed } from "vue";

const props = defineProps({ book: { type: Object, required: true } });

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function prng(seed) {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const paths = computed(() => {
  const seed = hash((props.book.name || "") + (props.book.author || ""));
  const rand = prng(seed);
  const cx = 20, cy = 20;
  const numArms = 3 + (seed % 4); // 3–6 arms
  const result = [];

  for (let a = 0; a < numArms; a++) {
    const baseAngle = (a / numArms) * Math.PI * 2;
    const jitter = (rand() - 0.5) * (Math.PI / numArms) * 0.5;
    const angle = baseAngle + jitter;
    const len = 7 + rand() * 6;

    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;

    const perp = angle + Math.PI / 2;
    const bend = (rand() - 0.5) * 8;

    const c1x = cx + Math.cos(angle) * len * 0.38 + Math.cos(perp) * bend;
    const c1y = cy + Math.sin(angle) * len * 0.38 + Math.sin(perp) * bend;
    const c2x = cx + Math.cos(angle) * len * 0.72 + Math.cos(perp) * bend * 0.4;
    const c2y = cy + Math.sin(angle) * len * 0.72 + Math.sin(perp) * bend * 0.4;

    result.push(`M ${cx.toFixed(1)} ${cy.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${ex.toFixed(1)} ${ey.toFixed(1)}`);

    // small terminal dot on some arms
    if (rand() > 0.45) {
      result.push(`M ${(ex - 0.9).toFixed(1)} ${ey.toFixed(1)} a 0.9 0.9 0 1 0 1.8 0 a 0.9 0.9 0 1 0 -1.8 0`);
    }
  }

  // centre dot
  result.push(`M ${(cx - 1.2).toFixed(1)} ${cy.toFixed(1)} a 1.2 1.2 0 1 0 2.4 0 a 1.2 1.2 0 1 0 -2.4 0`);

  return result;
});
</script>

<template>
  <svg viewBox="0 0 40 40" class="fp" aria-hidden="true">
    <path v-for="(d, i) in paths" :key="i" :d="d" class="fp-line" />
  </svg>
</template>

<style scoped>
.fp {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.fp-line {
  fill: none;
  stroke: var(--accent, #a87e3c);
  stroke-width: 1.1;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
