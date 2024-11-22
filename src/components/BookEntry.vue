<script setup>
defineProps({
    title: {
        type: String,
        default: "Book",
    },
    rating: {
        type: Number,
        default: 0,
    },
    author: {
        type: String,
        default: "Author",
    },
    status: String,
    comment: String,
});
</script>

<template>
    <div class="w-full text-gruvbox-gray max-sm:text-sm hover:-translate-y-1">
        <div class="flex flex-row bg-gruvbox-bgS rounded-2xl border border-gruvboxDark-fg2">
            <div class="mx-2 py-2 rounded-2xl align-middle m-auto">
                <!-- <img :src="require('../assets/Covers/' + image + '')" alt="Book Cover"> -->
                <slot class="" />
            </div>
            <div
                class="w-full flex flex-col my-2 mr-2 px-2 pb-2 pt-1 rounded-2xl justify-between"
            >
                <div id="title" class="font-semibold pb-2 text-gruvbox-blue2">
                    <h1 class="inline">{{ title }}</h1>
                    <h2 class="inline"><br /></h2>
                    <h1 class="inline lowercase font-normal text-gruvbox-blue">{{ author }}</h1>
                    <!-- <h2 class="inline"> - </h2> -->
                    <!-- <h2 class="inline font-normal">★★★★☆</h2> -->
                    <!-- <p class="font-normal text-sm indent-2">{{ author }}</p> -->
                </div>
                <div id="rating" class=""></div>
                <div
                    id="comments"
                    class="h-10 bg-gruvboxDark-fg rounded px-2 flex text-gruvbox-green2"
                >
                    <p class="my-auto lowercase">{{ comment }}</p>
                </div>
            </div>
        </div>
    </div>
</template>
