<template>
  <button
    class="yr"
    :class="active ? 'yr-on' : ''"
    @click="$emit('select')"
    @keydown.enter="$emit('select')"
    type="button"
    :aria-pressed="active"
  >
    <span class="yr-label">{{ displayYear }}</span>
    <span class="yr-count">{{ count }}</span>
  </button>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps({
  year: [String, Number],
  count: { type: Number, default: 0 },
  active: { type: Boolean, default: false }
});
defineEmits(['select']);
const displayYear = computed(() => {
  const s = String(props.year).match(/\d{4}/);
  return s ? s[0] : String(props.year).slice(0, 4);
});
</script>

<style scoped>
.yr {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  box-shadow: inset 2px 0 0 transparent;
  transition: box-shadow 140ms, background 140ms;
  border-radius: 6px;
  outline: none;
  text-align: left;
}
.yr:focus-visible { box-shadow: 0 0 0 2px #5a7040; }
.yr:not(.yr-on):hover {
  background: rgba(255,245,215,0.03);
  box-shadow: inset 2px 0 0 #3a3620;
}
.yr-on {
  box-shadow: inset 2px 0 0 #7a9050;
  background: rgba(255,245,215,0.04);
}

.yr-label {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  transition: color 140ms;
}
.yr:not(.yr-on) .yr-label { color: #4a4630; }
.yr:not(.yr-on):hover .yr-label { color: #7a7450; }
.yr-on .yr-label { color: #c8b87c; }

.yr-count {
  margin-left: auto;
  font-size: 0.68rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition: color 140ms;
}
.yr:not(.yr-on) .yr-count { color: #322e1e; }
.yr-on .yr-count { color: #6a6040; }
</style>
