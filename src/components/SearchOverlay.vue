<script setup>
import { ref, computed, watch, nextTick } from "vue";
import Fuse from "fuse.js";

const props = defineProps({
  entries: { type: Array, default: () => [] },
  open: { type: Boolean, default: false },
});
const emit = defineEmits(["close", "select"]);

const query = ref("");
const inputRef = ref(null);
const activeIdx = ref(-1);

const fuse = computed(() => new Fuse(props.entries, {
  keys: [{ name: "name", weight: 2 }, { name: "author", weight: 1 }],
  threshold: 0.35,
  includeScore: true,
}));

const results = computed(() => {
  const q = query.value.trim();
  if (!q) return [];
  return fuse.value.search(q).slice(0, 9).map((r) => r.item);
});

watch(() => props.open, async (val) => {
  if (val) {
    query.value = "";
    activeIdx.value = -1;
    await nextTick();
    inputRef.value?.focus();
  }
});

function close() { emit("close"); }

function select(book) {
  emit("select", book);
  close();
}

function onKeydown(e) {
  if (e.key === "Escape") { close(); return; }
  if (e.key === "ArrowDown") { e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1); return; }
  if (e.key === "ArrowUp") { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, -1); return; }
  if (e.key === "Enter" && activeIdx.value >= 0 && results.value[activeIdx.value]) {
    e.preventDefault();
    select(results.value[activeIdx.value]);
    return;
  }
}

function shortStatus(book) {
  if (book.finished === undefined) {
    if (!book.finish) return "";
    return /^started/i.test(book.finish) ? "in progress" : book.finish.replace(/^Finished\s*/i, "");
  }
  return book.finished ? book.date : "in progress";
}
</script>

<template>
  <Transition name="so">
    <div v-if="open" class="overlay" @click.self="close" @keydown="onKeydown">
      <div class="box">

        <div class="search-row">
          <svg class="search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/>
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            class="search-input"
            placeholder="Search books and authors…"
            autocomplete="off"
            spellcheck="false"
            @keydown="onKeydown"
          />
          <kbd class="esc-key" @click="close">esc</kbd>
        </div>

        <ul v-if="results.length" class="results">
          <li
            v-for="(book, i) in results"
            :key="book.name + book.year"
            class="result"
            :class="{ 'result-active': i === activeIdx }"
            @mouseenter="activeIdx = i"
            @click="select(book)"
          >
            <div class="r-img-wrap">
              <img v-if="book.img" :src="book.img" :alt="book.name" class="r-img" loading="lazy" />
              <div v-else class="r-img-empty"></div>
            </div>
            <div class="r-text">
              <span class="r-name">{{ book.name }}</span>
              <span class="r-author">{{ book.author }}</span>
            </div>
            <div class="r-meta">
              <span class="r-year">{{ book.year }}</span>
              <span class="r-status">{{ shortStatus(book) }}</span>
            </div>
          </li>
        </ul>

        <p v-else-if="query.trim()" class="no-results">No results for "{{ query }}"</p>

        <p v-else class="hint">Type to search {{ entries.length }} books</p>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(12, 11, 7, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 4rem 0.75rem 1rem;
}
@media (min-width: 640px) { .overlay { padding: 6rem 1rem 1rem; } }

.box {
  width: 100%;
  max-width: 580px;
  background: #1c1a12;
  border: 1px solid #2a2618;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
}

/* ── Search input row ─────────────────────────────── */
.search-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #211f15;
}

.search-icon { color: #3c3924; flex-shrink: 0; }

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e0d4b4;
  font-size: 1rem;
  font-family: inherit;
  caret-color: #7a8c58;
}
.search-input::placeholder { color: #3c3924; }

.esc-key {
  font-size: 0.65rem;
  font-family: inherit;
  color: #3c3924;
  border: 1px solid #2a2618;
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 120ms;
}
.esc-key:hover { color: #7a8c58; }

/* ── Results ──────────────────────────────────────── */
.results {
  list-style: none;
  margin: 0;
  padding: 0.4rem 0;
  max-height: min(420px, 52vh);
  overflow-y: auto;
}

.result {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.6rem 1rem;
  cursor: pointer;
  transition: background 100ms;
}
.result-active { background: rgba(255,245,215,0.04); }

.r-img-wrap { flex-shrink: 0; }
.r-img {
  width: 36px;
  height: 52px;
  object-fit: contain;
  border-radius: 3px;
  background: #1a1812;
  display: block;
}
.r-img-empty {
  width: 36px;
  height: 52px;
  border-radius: 3px;
  background: #1a1812;
}

.r-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.r-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e0d4b4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.r-author {
  font-size: 0.72rem;
  color: #728a50;
}

.r-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
.r-year  { font-size: 0.7rem; font-weight: 700; color: #3c3924; font-variant-numeric: tabular-nums; }
.r-status { font-size: 0.68rem; color: #a87e3c; white-space: nowrap; }

/* ── Empty states ─────────────────────────────────── */
.no-results, .hint {
  padding: 1.25rem 1rem;
  font-size: 0.82rem;
  color: #3c3924;
  margin: 0;
  text-align: center;
}

/* ── Transition ───────────────────────────────────── */
.so-enter-active { transition: opacity 140ms ease, transform 140ms ease; }
.so-leave-active { transition: opacity 100ms ease, transform 100ms ease; }
.so-enter-from, .so-leave-to { opacity: 0; }
.so-enter-from .box { transform: translateY(-8px); }
.so-leave-to .box   { transform: translateY(-4px); }
</style>
