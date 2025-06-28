<script setup>
import BookEntry from "../components/BookEntry.vue";
import { planningEntries } from "../javascript/planningData.js";
import WebHeader from "../components/WebHeader.vue";
import WebFooter from "../components/WebFooter.vue";
</script>

<script>
export default {
    data() {
        return {
            bookData: planningEntries,
        };
    },
};
</script>

<template>
    <div class="min-h-screen bg-gruvboxDark-bg">
        <div class="min-h-screen">
            <WebHeader>
                <div class="md:block hidden">
                    <h1
                        v-if="index == selectedYearIndex"
                        class="mr-2 text-gruvbox-green text-xl pl-12 mt-1 select-none"
                    >
                        Planning
                    </h1>
                </div>
            </WebHeader>

            <div class="mx-2 xl:mx-56 shrink grow">
                <div
                    class="md:my-6 my-4 w-full grid grid-cols-1 grid-flow-row md:grid-cols-2 gap-4"
                >
                    <BookEntry
                        v-for="book in bookData"
                        :title="book.name"
                        :author="book.author"
                        :comment="book.finish"
                        ><img
                            class="rounded-l h-32 w-20 object-cover"
                            :src="book.img"
                            :alt="book.name"
                    /></BookEntry>
                </div>
            </div>
        </div>

        <WebFooter />
    </div>
</template>
