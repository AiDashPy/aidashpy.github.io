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
    <div class="w-full md:w-1/2 md:p-2 py-2 text-zinc-200 max-sm:text-sm">
        <div class="flex flex-row bg-gbgraytb rounded-2xl">
            <div class="mx-2 py-2 rounded-2xl align-middle m-auto">
                <!-- <img :src="require('../assets/Covers/' + image + '')" alt="Book Cover"> -->
                <slot />
            </div>
            <div
                class="w-full flex flex-col my-2 mr-2 px-2 pb-2 pt-1 rounded-2xl justify-between"
            >
                <div id="title" class="font-semibold pb-2">
                    <h1 class="inline">{{ title }}</h1>
                    <h2 class="inline"><br /></h2>
                    <h1 class="inline font-normal">{{ author }}</h1>
                    <!-- <h2 class="inline"> - </h2> -->
                    <!-- <h2 class="inline font-normal">★★★★☆</h2> -->
                    <!-- <p class="font-normal text-sm indent-2">{{ author }}</p> -->
                </div>
                <div id="rating" class=""></div>
                <div
                    id="comments"
                    class="h-10 bg-gbgraydark rounded px-2 flex"
                >
                    <p class="my-auto">{{ comment }}</p>
                </div>
            </div>
        </div>
    </div>
</template>
