<script setup>
import { RouterLink } from "vue-router";
import { yearlyBookEntries } from "../javascript/yearlyBookData";
</script>

<script>
    export default {
        data() {
            return {
                selectedYearIndex: 0,

            }
        },
        methods: {
            selectYear(index) {
                this.$emit('select-year', index)
                this.selectedYearIndex = index
            }
        }
    }
</script>

<template>
    <header id="nav" class="py-4 bg-gruvbox-dark-bg w-full border-b border-gruvbox-dark-bg-h lowercase">
        <div class="px-4 lg:w-250 2xl:w-350 mx-auto flex flex-row font-mono text-2xl justify-between align-middle">
            <RouterLink class="select-none text-gruvbox-red" to="/">Aidashpy</RouterLink>

            <div class="md:flex md:flex-row hidden pl-12">
                <div class="mt-1 text-xl" v-for="(year, index) in yearlyBookEntries">
                    <button v-if="index == selectedYearIndex" class="mr-2 text-gruvbox-green active:text-gruvbox-dark-green2 cursor-pointer" @click="selectYear(index)">{{ year.year }}</button>
                    <button v-else class="mr-2 text-gruvbox-green2 active:text-gruvbox-green cursor-pointer" @click="selectYear(index)">{{ year.year }}</button>
                </div>
            </div>

            <p class="select-none text-gruvbox-blue">Reading Log</p>
        </div>
    </header>
</template>
