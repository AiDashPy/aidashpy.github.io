<script setup>
    import { RouterLink } from "vue-router";
</script>

<template>
    <header id="nav" class="py-4 bg-gruvbox-bgS w-full border-b border-gruvboxDark-fg2 lowercase">
        <div
            class="mx-4 xl:mx-56 flex flex-row font-mono text-2xl justify-between align-middle"
        >
            <RouterLink to="/"><h1 class="select-none text-gruvbox-red2">Aidashpy</h1></RouterLink>
            <!-- <h1 class="select-none text-gruvbox-orange2 ">---</h1> -->
            <slot/>
            <RouterLink to="/planning"><h1 class="select-none text-gruvbox-blue2">Reading Log</h1></RouterLink>
        </div>
    </header>
</template>
