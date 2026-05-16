<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { audioMuted, toggleMute } from "../composables/useAudio";

const router = useRouter();
let tapCount = 0;
let tapTimer = null;
function onLogoClick(e) {
  e.preventDefault();
  tapCount++;
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapCount = 0; }, 1500);
  if (tapCount >= 7) {
    tapCount = 0;
    clearTimeout(tapTimer);
    router.push("/admin");
  } else {
    router.push("/");
  }
}

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
      <a href="/" class="logo" @click="onLogoClick">aidashpy</a>
      <nav class="nav">
        <RouterLink to="/links" class="nav-a">links</RouterLink>
        <button class="nav-mute" @click="toggleMute" :title="audioMuted ? 'Unmute' : 'Mute'" :aria-label="audioMuted ? 'Unmute' : 'Mute'">
          <svg v-if="!audioMuted" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 5H3.5L7 2V12L3.5 9H1.5Z" fill="currentColor"/>
            <path d="M9 4.8C9.7 5.4 10.2 6.2 10.2 7C10.2 7.8 9.7 8.6 9 9.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M10.8 3.2C12 4.2 12.8 5.5 12.8 7C12.8 8.5 12 9.8 10.8 10.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 5H3.5L7 2V12L3.5 9H1.5Z" fill="currentColor"/>
            <line x1="9.5" y1="5" x2="12.5" y2="8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="12.5" y1="5" x2="9.5" y2="8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
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

.nav-mute {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: #4a4630;
  cursor: pointer;
  border-radius: 6px;
  transition: color 130ms, background 130ms;
  margin-left: 2px;
}
.nav-mute:hover { color: #8a8260; background: rgba(255,245,215,0.04); }
</style>
