<template>
  <div id="app-root" class="min-h-screen w-screen bg-[#1d2021] text-[#ebdbb2] font-sans">
    <!-- centered canvas with responsive gutters and top offset for header -->
    <div class="app-shell w-full max-w-[1440px] mx-auto px-2 sm:px-2 md:px-8 pt-24">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { RouterView } from "vue-router";
</script>
