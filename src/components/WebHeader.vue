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
  width: 100%;
  background: rgba(22, 20, 13, 0.82);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(37, 33, 16, 0.7);
  padding: 11px 0;
  transition: transform 360ms ease, opacity 360ms ease;
}
.hdr-off { transform: translateY(-100%); opacity: 0; pointer-events: none; }

.hdr-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-weight: 800;
  font-size: 0.875rem;
  color: #a09070;
  text-decoration: none;
  letter-spacing: 0.08em;
  transition: color 130ms;
}
.logo:hover { color: #c8ba8c; }

.nav { display: flex; }

.nav-a {
  font-size: 0.75rem;
  font-weight: 600;
  color: #4a4630;
  text-decoration: none;
  letter-spacing: 0.05em;
  padding: 5px 10px;
  border-radius: 6px;
  transition: color 130ms, background 130ms;
}
.nav-a:hover { color: #8a8260; background: rgba(255,245,215,0.04); }
.nav-a.router-link-active { color: #7a8c58; }
</style>
