<script setup>
import BookEntry from "../components/BookEntry.vue";
import WebFooter from "../components/WebFooter.vue";
import WebHeader from "../components/WebHeader.vue";
import { yearlyBookEntries } from "../javascript/yearlyBookData";
</script>

<script>
export default {
    data() {
        return {
            yearlyBookEntries: yearlyBookEntries,
            selectedYearIndex: 0,
        };
    },
};
</script>

<template>
    <div class="min-h-screen bg-gruvbox-dark-bg">
        <div class="min-h-screen">
            <WebHeader>
                <div class="md:flex md:flex-row hidden pl-12">
                    <div
                        class="mt-1 text-xl"
                        v-for="(year, index) in yearlyBookEntries"
                    >
                        <button
                            v-if="index == selectedYearIndex"
                            class="mr-2 text-gruvbox-green active:text-gruvbox-dark-green2 cursor-pointer"
                            @click="selectedYearIndex = index"
                        >
                            {{ year.year }}
                        </button>
                        <button
                            v-else
                            class="mr-2 text-gruvbox-green2 active:text-gruvbox-green cursor-pointer"
                            @click="selectedYearIndex = index"
                        >
                            {{ year.year }}
                        </button>
                    </div>
                </div>
            </WebHeader>

            <div class="px-4 lg:w-250 2xl:w-350 mx-auto shrink grow">
                <div
                    class="md:my-4 mt-4 mb-2 w-full grid grid-cols-1 grid-flow-row md:grid-cols-2 gap-4"
                >
                    <BookEntry
                        v-for="book in yearlyBookEntries[selectedYearIndex]
                            .entries"
                        :title="book.name"
                        :author="book.author"
                        :comment="book.finish"
                    >
                        <img
                            class="rounded-l h-32 w-20 object-cover"
                            :src="book.img"
                            :alt="book.name"
                    /></BookEntry>
                </div>
            </div>
        </div>

        <div class="md:hidden flex flex-row justify-center bg-gruvboxDark pb-1">
            <div class="text-base" v-for="(year, index) in yearlyBookEntries">
                <button
                    v-if="index == selectedYearIndex"
                    class="mr-2 text-gruvbox-green active:text-gruvbox-dark-green2"
                    @click="selectedYearIndex = index"
                >
                    {{ year.year }}
                </button>
                <button
                    v-else
                    class="mr-2 text-gruvbox-green2 active:text-gruvbox-green"
                    @click="selectedYearIndex = index"
                >
                    {{ year.year }}
                </button>
            </div>
        </div>

        <WebFooter />
    </div>
</template>
