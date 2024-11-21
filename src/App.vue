<script setup>
    import WebHeader from "./components/WebHeader.vue";
    import BookEntry from "./components/BookEntry.vue";
    import WebFooter from "./components/WebFooter.vue";
    import { bookEntries } from "./components/bookData";
</script>

<template>
    <div class="min-h-screen bg-gruvbox-bg">
        <div class="min-h-screen">
            <WebHeader />
            <div class="mx-2 xl:mx-56 shrink grow">
                <div class="py-6 rounded-2xl w-full grid grid-cols-1 gap-4 md:grid-cols-2">
                    <BookEntry class="drop-shadow" v-for="book in bookEntries" :title="book.name" :author="book.author" :comment="book.finish"><img class="max-h-40 rounded-xl border border-gruvboxDark-fg2" :src="book.img" :alt="book.name"></BookEntry>
                </div>
            </div>
        </div>

        <WebFooter />
    </div>
</template>
