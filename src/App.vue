<template>
  <div id="app-root" class="min-h-screen w-full bg-[#1d2021] text-[#ebdbb2] font-sans overflow-x-hidden">
    <!-- centered canvas with responsive gutters and top offset for header -->
    <div class="app-shell w-full max-w-[1440px] mx-auto px-2 sm:px-3 md:px-4 pt-20 sm:pt-24">
      <RouterView />
    </div>
  </div>
</template>

<script setup>
import { RouterView } from "vue-router";
</script>
