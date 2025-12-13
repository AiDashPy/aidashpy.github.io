<script setup>
import { ref, onMounted } from "vue";
import { RouterLink } from "vue-router";

const created = ref(false);
const showOverlay = ref(true);

onMounted(() => {
  created.value = true;
  // fallback hide overlay after 1300ms in case animationend doesn't fire
  setTimeout(() => { showOverlay.value = false; }, 1400);
});

function onOverlayEnd() {
  showOverlay.value = false;
}
</script>

<template>
  <!-- fixed full-viewport root with small responsive gutters -->
  <!-- neutral dark-gray base with soviet accents -->
  <div class="fixed inset-0 overflow-hidden bg-[#1f1f21] flex items-center justify-center px-4 sm:px-6 md:px-8">
    <!-- animated SVG overlay (soviet red star) -->
    <div v-if="showOverlay" class="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
      <!-- inline soviet-red star SVG -->
      <svg
        class="w-40 h-40 sm:w-56 sm:h-56 overlay-svg"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        @animationend="onOverlayEnd"
      >
        <!-- soviet red star -->
        <polygon points="50,5 61,39 98,39 67,59 79,91 50,72 21,91 33,59 2,39 39,39" fill="#c2201f"/>
      </svg>
    </div>

    <Transition>
      <!-- centered wrapper -->
      <div v-if="created" class="w-full flex items-center justify-center">
        <!-- card: change background to more grey and adjust border -->
        <div
          class="w-full max-w-5xl mx-auto bg-[#2b2b2b] border border-[#3f3f3f] rounded-2xl shadow-xl p-8 md:p-12 flex flex-col items-center transform transition-all duration-500"
          :class="showOverlay ? 'scale-90 rotate-6 opacity-0' : 'scale-100 rotate-0 opacity-100'"
          style="max-height: calc(100vh - 4rem); overflow: hidden;"
        >
          <h1 class="text-[#ffd66b] font-extrabold text-4xl md:text-5xl text-center select-none mb-6">aidashpy</h1>

          <div class="w-full max-w-2xl mx-auto mb-6">
            <!-- link to culture.ru for the painting -->
            <a href="https://www.culture.ru/persons/9593/konstantin-yuon" target="_blank" rel="noopener noreferrer" class="block">
              <img class="w-full rounded-md object-contain max-h-[40vh] border border-[#3f3f3f]/10" src="/images/ThePaintingNewPlanetNew.webp" alt="New Planet, Konstantin Yuon, 1921" />
            </a>
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
/* overlay SVG animation: rotate in, swell, then fade (animation duration ~1.2s) */
@keyframes overlaySpin {
  0% { transform: rotate(-90deg) scale(0.6); opacity: 0; filter: blur(0.5px); }
  40% { transform: rotate(20deg) scale(1.15); opacity: 1; filter: blur(0); }
  70% { transform: rotate(-6deg) scale(1.05); opacity: 0.9; }
  100% { transform: rotate(-6deg) scale(1.05); opacity: 0; }
}
/* apply the animation to the SVG overlay */
.overlay-svg {
  animation: overlaySpin 1.2s cubic-bezier(.2,.9,.25,1) both;
  transform-origin: center;
}

/* removed external-filter rule; star uses direct fill color */
</style>
