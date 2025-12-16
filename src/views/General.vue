<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"; // added onBeforeUnmount
import { RouterLink } from "vue-router";
import { yearlyBookEntries } from "../javascript/yearlyBookData";

const created = ref(false);
const showOverlay = ref(true);

const cardRef = ref(null);
const cardStyle = ref({});
let targetTiltX = 0;
let targetTiltY = 0;
let currentTiltX = 0;
let currentTiltY = 0;
let targetTx = 0;
let targetTy = 0;
let currentTx = 0;
let currentTy = 0;
const maxTilt = 1.5; // degrees (subtle)
const maxTranslate = 6; // px (subtle)

// new: flag to mark the initial entry
const justEntered = ref(false);

// unified updater that can use smooth transition for the initial on
function updateCardStyle(useSmooth = false) {
  const hoverMag = Math.min(1, Math.hypot(currentTiltX, currentTiltY) / (maxTilt * 0.6));
  const scale = 1 + 0.01 * hoverMag;
  cardStyle.value = {
    transform: `perspective(1000px) translate3d(${currentTx}px, ${currentTy}px, 0) rotateX(${currentTiltX}deg) rotateY(${currentTiltY}deg) scale(${scale})`,
    willChange: "transform",
    transition: useSmooth ? "transform 820ms cubic-bezier(.22,1,.36,1)" : "none",
  };
}

function handleMouseMove(e) {
  const el = cardRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left; // x within element
  const y = e.clientY - rect.top;
  const nx = (x - rect.width / 2) / (rect.width / 2); // -1..1
  const ny = (y - rect.height / 2) / (rect.height / 2); // -1..1

  targetTiltY = nx * maxTilt * -1; // rotateY (invert for natural direction)
  targetTiltX = -ny * maxTilt; // inverted so area under cursor is pushed down
  targetTx = nx * maxTranslate;
  targetTy = ny * maxTranslate * -1;

  // apply immediately; use smooth transition only for the very first movement after enter
  currentTiltX = targetTiltX;
  currentTiltY = targetTiltY;
  currentTx = targetTx;
  currentTy = targetTy;
  updateCardStyle(justEntered.value);
  if (justEntered.value) justEntered.value = false;
}

function handleMouseEnter() {
  justEntered.value = true;
}

function handleMouseLeave() {
  // reset to neutral with a very smooth, slow snap-back
  currentTiltX = 0;
  currentTiltY = 0;
  currentTx = 0;
  currentTy = 0;
  const scale = 1;
  cardStyle.value = {
    transform: `perspective(1000px) translate3d(0px, 0px, 0) rotateX(0deg) rotateY(0deg) scale(${scale})`,
    willChange: "transform",
    transition: "transform 820ms cubic-bezier(.22,1,.36,1)", // slower & very smooth
  };
}

function onOverlayEnd() {
  showOverlay.value = false;
}

const gyroAttached = ref(false);
async function requestGyroPermission() {
  // iOS 13+ requires a user gesture to request permission
  if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === "granted") {
        attachGyro();
      }
    } catch (err) {
      // permission denied or not available
    }
  } else {
    // non-iOS or older browsers — attach directly
    attachGyro();
  }
}

function attachGyro() {
  if (gyroAttached.value) return;
  window.addEventListener("deviceorientation", handleDeviceOrientation, true);
  gyroAttached.value = true;
}

function detachGyro() {
  if (!gyroAttached.value) return;
  window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  gyroAttached.value = false;
}

function handleDeviceOrientation(ev) {
  // map device orientation to normalized -1..1 values
  const gamma = ev.gamma ?? 0; // left/right tilt ~ -90..90
  const beta = ev.beta ?? 0;   // front/back tilt ~ -180..180

  // normalize and clamp to [-1,1] using a sensible divisor (45deg)
  const nx = Math.max(-1, Math.min(1, gamma / 45));
  const ny = Math.max(-1, Math.min(1, beta / 45));

  targetTiltY = nx * maxTilt * -1;
  targetTiltX = -ny * maxTilt;
  targetTx = nx * maxTranslate;
  targetTy = ny * maxTranslate * -1;

  // apply immediately; initial gyro-on should be smooth like mouse-on
  currentTiltX = targetTiltX;
  currentTiltY = targetTiltY;
  currentTx = targetTx;
  currentTy = targetTy;
  updateCardStyle(justEntered.value);
  if (justEntered.value) justEntered.value = false;
}

onMounted(() => {
  created.value = true;
  // fallback hide overlay after 1300ms in case animationend doesn't fire
  setTimeout(() => { showOverlay.value = false; }, 1400);

  // Prefetch all book images so General page feels faster (downloads in background)
  try {
    yearlyBookEntries.forEach((year) => {
      (year.entries || []).forEach((e) => {
        if (e && e.img) {
          const img = new Image();
          img.src = e.img;
        }
      });
    });
    // also prefetch the main painting explicitly
    const mainImg = new Image();
    mainImg.src = '/images/ThePaintingNewPlanetNew.webp';
  } catch (err) {
    // fail silently
  }

  // initial neutral style (use same very smooth transition for consistent snap-back)
  cardStyle.value = {
    transform: "none",
    willChange: "transform",
    transition: "transform 820ms cubic-bezier(.22,1,.36,1)",
  };

  // request permission on first touch/click (user gesture) for iOS; attach directly otherwise
  window.addEventListener("touchstart", requestGyroPermission, { once: true, passive: true });
  window.addEventListener("click", requestGyroPermission, { once: true, passive: true });
});

onBeforeUnmount(() => {
  // remove gyro listeners and any pending request handlers
  detachGyro();
  window.removeEventListener("touchstart", requestGyroPermission);
  window.removeEventListener("click", requestGyroPermission);
});
</script>

<template>
  <!-- constrain to viewport minus app top padding (pt-20 = 5rem) and center vertically -->
  <div class="w-full min-w-0 overflow-x-hidden bg-[#1f1f21] flex items-center justify-center px-4 sm:px-6 md:px-8 min-h-[calc(100vh-5rem)]">
    <!-- animated SVG overlay (fallback timer still hides it) -->
    <div v-if="showOverlay" class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <svg
        class="overlay-svg w-40 h-40 sm:w-56 sm:h-56"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        @animationend="onOverlayEnd"
      >
        <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="#c2201f"/>
      </svg>
    </div>

    <Transition>
      <!-- centered wrapper -->
      <div v-if="created" class="w-full flex items-center justify-center">
        <!-- card: change background to more grey and adjust border -->
        <div
          ref="cardRef"
          @mouseenter="handleMouseEnter"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
          class="w-full max-w-5xl mx-auto bg-[#2b2b2b] border border-[#3f3f3f] rounded-2xl shadow-xl p-8 md:p-12 flex flex-col items-center transform transition-all duration-500 will-change-transform"
          :class="showOverlay ? 'scale-90 rotate-6 opacity-0' : 'scale-100 rotate-0 opacity-100'"
          :style="[cardStyle, { maxHeight: 'calc(100vh - 6rem)', overflow: 'auto' }]"
        >
          <h1 class="text-[#ffd66b] font-extrabold text-4xl md:text-5xl text-center select-none mb-6">aidashpy</h1>

          <div class="w-full max-w-2xl mx-auto mb-6">
            <RouterLink to="/" class="block">
              <!-- eager + high priority so painting appears ASAP -->
              <img
                class="w-full rounded-md object-contain max-h-[40vh]"
                src="/images/ThePaintingNewPlanetNew.webp"
                alt="New Planet, Konstantin Yuon, 1921"
                loading="eager"
                fetchpriority="high"
                decoding="async"
              />
            </RouterLink>
          </div>

          <div class="flex flex-row flex-wrap items-center justify-center gap-4 text-sm md:text-base text-[#dcd7cf]">
            <RouterLink to="/" class="inline-block px-3 py-2 rounded hover:bg-[#c2201f]/10 text-[#c2201f]">reading</RouterLink>
            <a href="https://letterboxd.com/aidashpy/" target="_blank" class="inline-block px-3 py-2 rounded hover:bg-[#c2201f]/10 text-[#c2201f]">letterboxd</a>
            <a href="https://anilist.co/user/Aidashpy/" target="_blank" class="inline-block px-3 py-2 rounded hover:bg-[#c2201f]/10 text-[#c2201f]">anilist</a>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* restored overlay animation for the star */
@keyframes overlaySpin {
  0% { transform: rotate(-90deg) scale(0.6); opacity: 0; filter: blur(0.5px); }
  40% { transform: rotate(20deg) scale(1.15); opacity: 1; filter: blur(0); }
  70% { transform: rotate(-6deg) scale(1.05); opacity: 0.9; }
  100% { transform: rotate(-6deg) scale(1.05); opacity: 0; }
}
.overlay-svg {
  animation: overlaySpin 1.2s cubic-bezier(.2,.9,.25,1) both;
  transform-origin: center;
}
</style>
