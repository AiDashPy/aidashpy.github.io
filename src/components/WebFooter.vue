<script setup>
import { RouterLink } from "vue-router";
const top = () => window.scrollTo({ top: 0, behavior: "smooth" });
</script>

<template>
  <footer class="ft">
    <div class="ft-inner">
      <span class="ft-mark">· · ·</span>
      <div class="ft-links">
        <a class="fl" href="https://www.goodreads.com/review/list/168293432?ref=nav_mybooks" target="_blank" rel="noopener noreferrer">Goodreads</a>
        <RouterLink class="fl" to="/links">links</RouterLink>
        <button class="fl fl-btn" @click="top" aria-label="Scroll to top">↑ Top</button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.ft {
  border-top: 1px solid #252110;
  margin-top: 1rem;
}
.ft-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
@media (min-width: 640px)  { .ft-inner { padding: 1rem 1.75rem; } }
@media (min-width: 1024px) { .ft-inner { padding: 1rem 1.5rem; } }

.ft-mark { font-size: 10px; color: #2e2b1c; letter-spacing: 0.1em; user-select: none; }

.ft-links { display: flex; gap: 2px; }

.fl {
  font-size: 0.76rem;
  font-weight: 500;
  color: #4a4630;
  text-decoration: none;
  padding: 4px 9px;
  border-radius: 6px;
  transition: color 130ms, background 130ms;
}
.fl:hover { color: #8a8260; background: rgba(255,245,215,0.04); }
.fl-btn { border: none; background: transparent; cursor: pointer; font-family: inherit; }
</style>
