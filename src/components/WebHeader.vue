<script setup>
import { RouterLink } from "vue-router";
</script>

<template>
    <header
        id="nav"
        class="py-4 bg-gruvbox-dark-bg w-full border-b border-gruvbox-dark-bg-h lowercase"
    >
        <div
            class="px-4 lg:w-250 2xl:w-350 mx-auto flex flex-row font-mono text-2xl justify-between align-middle"
        >
            <RouterLink to="/"
                ><h1 class="select-none text-gruvbox-red">
                    Aidashpy
                </h1></RouterLink
            >
            <!-- <h1 class="select-none text-gruvbox-orange2 ">---</h1> -->
            <slot />
            <RouterLink to="/planning"
                ><h1 class="select-none text-gruvbox-blue">
                    Reading Log
                </h1></RouterLink
            >
        </div>
    </header>
</template>
