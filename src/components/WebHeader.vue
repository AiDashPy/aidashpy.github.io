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
let lastY = 0, ticking = false, ready = false;

function onScroll() {
  const y = window.scrollY || 0;
  if (!ticking) {
    window.requestAnimationFrame(() => {
      if (ready) {
        if (y > lastY + 10) visible.value = false;
        else if (y < lastY - 10) visible.value = true;
      }
      lastY = y; ticking = false;
    });
    ticking = true;
  }
}
onMounted(() => {
  lastY = window.scrollY || 0;
  window.addEventListener('scroll', onScroll, { passive: true });
  // Allow browser scroll restoration to settle before tracking direction.
  // Without this, the restoration scroll event (lastY=0 → restored position)
  // looks like a big downward scroll and hides the header on refresh.
  setTimeout(() => { lastY = window.scrollY || 0; ready = true; }, 80);
});
onUnmounted(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <header class="hdr" :class="visible ? '' : 'hdr-off'">
    <div class="hdr-inner">
      <a href="/" class="logo" @click="onLogoClick">
        <span class="logo-bar" aria-hidden="true"></span>
        <span class="logo-text">AIDASHPY</span>
      </a>

      <nav class="nav">
        <RouterLink to="/links" class="nav-a">
          <span class="nav-num" aria-hidden="true">01</span>
          <span class="nav-div" aria-hidden="true"></span>
          <span class="nav-label">LINKS</span>
        </RouterLink>

        <button class="nav-mute" @click="toggleMute" :title="audioMuted ? 'Unmute' : 'Mute'" :aria-label="audioMuted ? 'Unmute' : 'Mute'">
          <svg v-if="!audioMuted" width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 5H3.5L7 2V12L3.5 9H1.5Z" fill="currentColor"/>
            <path d="M9 4.8C9.7 5.4 10.2 6.2 10.2 7C10.2 7.8 9.7 8.6 9 9.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M10.8 3.2C12 4.2 12.8 5.5 12.8 7C12.8 8.5 12 9.8 10.8 10.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <svg v-else width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1.5 5H3.5L7 2V12L3.5 9H1.5Z" fill="currentColor"/>
            <line x1="9.5" y1="5" x2="12.5" y2="8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <line x1="12.5" y1="5" x2="9.5" y2="8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </button>
      </nav>
    </div>

    <div class="hdr-rule" aria-hidden="true"></div>
  </header>
</template>

<style scoped>
@import '@fontsource/bebas-neue/index.css';
@import '@fontsource/oswald/500.css';
@import '@fontsource/oswald/700.css';

.hdr {
  position: fixed;
  left: 0; top: 0;
  z-index: 100;
  width: 100%;
  background: rgba(19, 17, 8, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: transform 360ms ease, opacity 360ms ease;
}
.hdr-off { transform: translateY(-100%); opacity: 0; pointer-events: none; }

.hdr-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* ── Logo ─────────────────────────────────────────────────── */
.logo {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  text-decoration: none;
}

.logo-bar {
  display: block;
  width: 3px;
  height: 1.35rem;
  background: #7a8c58;
  flex-shrink: 0;
  transition: background 200ms;
}
.logo:hover .logo-bar { background: #8fa066; }

.logo-text {
  font-family: 'Bebas Neue', 'Arial Narrow', Arial, sans-serif;
  font-size: 1.35rem;
  letter-spacing: 0.06em;
  color: #c8ba8c;
  line-height: 1;
  transition: color 200ms;
}
.logo:hover .logo-text { color: #e0d4b4; }

/* ── Nav ──────────────────────────────────────────────────── */
.nav {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.nav-a {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  text-decoration: none;
  padding: 0.3rem 0.6rem;
  clip-path: polygon(0 0, 100% 0, calc(100% - 6px) 100%, 0 100%);
  background: transparent;
  transition: background 150ms;
}
.nav-a:hover { background: rgba(122, 140, 88, 0.12); }
.nav-a.router-link-active { background: rgba(122, 140, 88, 0.08); }

.nav-num {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.55rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #7a8c58;
}
.nav-a.router-link-active .nav-num { color: #8fa066; }

.nav-div {
  display: block;
  width: 1px;
  height: 0.75rem;
  background: rgba(122, 140, 88, 0.3);
}

.nav-label {
  font-family: 'Oswald', 'Arial Narrow', Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #3c3924;
  text-transform: uppercase;
  transition: color 150ms;
}
.nav-a:hover .nav-label { color: #c8ba8c; }
.nav-a.router-link-active .nav-label { color: #c8ba8c; }

/* ── Mute button ──────────────────────────────────────────── */
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
  transition: color 150ms;
  margin-left: 4px;
}
.nav-mute:hover { color: #8a7e5a; }

/* ── Bottom rule ──────────────────────────────────────────── */
.hdr-rule {
  height: 2px;
  background: linear-gradient(90deg, #7a8c58 0%, rgba(122,140,88,0.3) 60%, transparent 100%);
}
</style>
