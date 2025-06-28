<script setup>
import { RouterLink } from "vue-router";
import GoodreadsSearcher from "./GoodreadsSearcher.vue";
</script>

<template>
    <footer>
        <div class="bg-gruvboxDark-bg py-2 border-t border-gruvboxDark-bgH">
            <div class="flex flex-row text-gruvbox-red justify-center">
                <a
                    class="text-sm underline mx-2"
                    href="https://www.goodreads.com/review/list/168293432?ref=nav_mybooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    >goodreads</a
                >
                <RouterLink
                    to="/links"
                    class="text-sm underline mx-2"
                    target="_blank"
                    >links</RouterLink
                >
                <!-- <GoodreadsSearcher/> -->
            </div>
        </div>
    </footer>
</template>
