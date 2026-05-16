<template>
  <NoiseCanvas />
  <div id="app-root">
    <RouterView />
  </div>
</template>

<script setup>
import { RouterView } from "vue-router";
import NoiseCanvas from "./components/NoiseCanvas.vue";
</script>

<style>
body { background: #16140d; }
#app-root { overflow-x: hidden; position: relative; z-index: 1; }
</style>
