<template>
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md transition transform shadow-sm hover:-translate-x-1 hover:shadow-lg focus:outline-none"
    :class="active ? 'bg-white/5 text-[#b8bb26] shadow-md' : 'bg-transparent text-[#ebdbb2]'"
    @click="$emit('select')"
    @keydown.enter="$emit('select')"
    type="button"
    :aria-pressed="active"
  >
    <span class="font-extrabold tracking-widest text-sm">{{ displayYear }}</span>
    <span class="text-sm text-[#a89984] opacity-60 font-semibold">{{ count }}</span>
  </button>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps({
  year: [String, Number],
  count: { type: Number, default: 0 },
  active: { type: Boolean, default: false }
});
const emit = defineEmits(['select']);
const displayYear = computed(() => {
  const s = String(props.year).match(/\d{4}/);
  return s ? s[0] : String(props.year).slice(0,4);
});
</script>
