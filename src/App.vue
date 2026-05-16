<template>
  <NoiseCanvas />
  <GrainOverlay />
  <div id="app-root">
    <RouterView />
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from "vue";
import { RouterView } from "vue-router";
import NoiseCanvas from "./components/NoiseCanvas.vue";
import GrainOverlay from "./components/GrainOverlay.vue";
import { initLenis, destroyLenis } from "./composables/useLenis";

onMounted(() => initLenis());
onUnmounted(() => destroyLenis());
</script>

<style>
body { background: #16140d; }
#app-root { overflow-x: hidden; position: relative; z-index: 1; }
</style>
