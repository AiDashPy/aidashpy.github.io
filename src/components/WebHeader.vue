<script setup>
import { RouterLink } from "vue-router";
import { ref, onMounted, onUnmounted } from "vue";

const visible = ref(true);
let lastY = 0, ticking = false;

function onScroll() {
  const y = window.scrollY || 0;
  if (!ticking) {
    window.requestAnimationFrame(() => {
      if (y > lastY + 10) visible.value = false;
      else if (y < lastY - 10) visible.value = true;
      lastY = y; ticking = false;
    });
    ticking = true;
  }
}
onMounted(() => { lastY = window.scrollY || 0; window.addEventListener('scroll', onScroll, { passive: true }); });
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <header class="hdr" :class="visible ? '' : 'hdr-off'">
    <div class="hdr-inner">
      <RouterLink to="/" class="logo">aidashpy</RouterLink>
      <nav class="nav">
        <RouterLink to="/links" class="nav-a">links</RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.hdr {
  position: fixed;
  left: 0; top: 0;
  z-index: 50;
  width: 100vw;
  background: #16140d;
  border-bottom: 1px solid #252110;
  padding: 12px 0;
  transition: transform 380ms ease, opacity 380ms ease;
}
.hdr-off { transform: translateY(-100%); opacity: 0; pointer-events: none; }

.hdr-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
@media (min-width: 640px)  { .hdr-inner { padding: 0 1.75rem; } }
@media (min-width: 1024px) { .hdr-inner { padding: 0 1.5rem; } }

.logo {
  font-weight: 800;
  font-size: 0.9375rem;
  color: #7a8c58;
  text-decoration: none;
  letter-spacing: 0.06em;
  transition: color 130ms;
}
.logo:hover { color: #9aac78; }

.nav { display: flex; }

.nav-a {
  font-size: 0.78rem;
  font-weight: 600;
  color: #5c5a48;
  text-decoration: none;
  letter-spacing: 0.04em;
  padding: 5px 10px;
  border-radius: 7px;
  transition: color 130ms, background 130ms;
}
.nav-a:hover { color: #9a9270; background: rgba(255,245,215,0.04); }
.nav-a.router-link-active { color: #7a8c58; }
</style>
