<script setup>
    import { RouterLink } from "vue-router";
</script>

<template>
    <footer>
        <div class="bg-gruvbox-dark-bg py-2 border-t border-gruvbox-dark-bg-h">
            <div class="flex flex-row text-gruvbox-red justify-center">
                <a class="text-sm underline mx-2" href="https://www.goodreads.com/review/list/168293432?ref=nav_mybooks" target="_blank" rel="noopener noreferrer" >goodreads</a>
                <RouterLink to="/links" class="text-sm underline mx-2" target="_blank" >links</RouterLink>
            </div>
        </div>
    </footer>
</template>
