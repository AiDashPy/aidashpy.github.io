<script setup>
    import VLazyImage from "v-lazy-image";
</script>

<script>
    export default {
        props: ['book'],
        data() {
            return {
            }
        }
    }
</script>

<template>
    <div class="flex flex-row overflow-hidden bg-gruvbox-dark-bg-s rounded-sm h-32">
        <img class="rounded-l h-32 w-20 object-cover" :src="book.img" :alt="book.name"/>
        <!-- <v-lazy-image class="rounded-l h-32 w-20 object-cover" :src="book.img" src-placeholder="https://placehold.co/400x600/32302F/webp?text=..." :alt="book.name" /> -->

        <div class="w-full flex flex-col ml-4 m-2 justify-between">
            <div id="title" class="font-semibold pb-2 flex flex-col text-gruvbox-blue">
                <h1 class="">{{ book.name }}</h1>
                <h1 class="lowercase font-normal">{{ book.author }}</h1>
            </div>

            <div id="comments" class="h-10 flex text-gruvbox-green">
                <p class="my-auto lowercase">{{ book.finish }}</p>
            </div>
        </div>
    </div>
</template>
