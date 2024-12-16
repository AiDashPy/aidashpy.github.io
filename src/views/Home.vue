<script setup>
    import BookEntry from "../components/BookEntry.vue";
import WebHeader from "../components/WebHeader.vue";
    import { yearlyBookEntries } from "../javascript/yearlyBookData";
</script>

<script>
    export default {
        data() {
            return {
                yearlyBookEntries: yearlyBookEntries,
                selectedYearIndex: 0
            }
        }
    }
</script>

<template>
    <div class="min-h-screen bg-gruvbox-bg">

        <div class="min-h-screen">

            <WebHeader>
                <div class="md:flex md:flex-row hidden pl-12">
                    <div class="mt-1 text-xl" v-for="(year, index) in yearlyBookEntries">
                        <button v-if="index == selectedYearIndex" class="mr-2 text-gruvbox-green2 active:text-gruvboxDark-green" @click="selectedYearIndex = index">{{ year.year }}</button>
                        <button v-else class="mr-2 text-gruvbox-green active:text-gruvbox-green2" @click="selectedYearIndex = index">{{ year.year }}</button>
                    </div>
                </div>
            </WebHeader>

            <div class="mx-2 xl:mx-56 shrink grow">

                <div class="py-6 rounded-2xl w-full grid grid-cols-1 gap-4 md:grid-cols-2">
                    <BookEntry class="drop-shadow" v-for="book in yearlyBookEntries[selectedYearIndex].entries" :title="book.name" :author="book.author" :comment="book.finish"><img class="max-h-40 rounded-xl border border-gruvboxDark-fg2" :src="book.img" :alt="book.name"></BookEntry>
                </div>

            </div>

        </div>

        <div class="md:hidden flex flex-row justify-center bg-gruvbox-bg1 pb-1">
            <div class="mt-1 text-base" v-for="(year, index) in yearlyBookEntries">
                <button v-if="index == selectedYearIndex" class="mr-2 text-gruvbox-green2 active:text-gruvboxDark-green" @click="selectedYearIndex = index">{{ year.year }}</button>
                <button v-else class="mr-2 text-gruvbox-green active:text-gruvbox-green2" @click="selectedYearIndex = index">{{ year.year }}</button>
            </div>
        </div>


    </div>

</template>