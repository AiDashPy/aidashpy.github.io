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
    <div class="flex flex-row bg-gruvboxDark-bgS rounded h-40">
        <slot />

        <div class="w-full flex flex-col ml-4 m-2 justify-between">
            <div id="title" class="font-semibold pb-2 text-gruvbox-blue">
                <h1 class="inline">{{ title }}</h1>
                <h2 class="inline"><br /></h2>
                <h1 class="inline lowercase font-normal">
                    {{ author }}
                </h1>
                <!-- <h2 class="inline"> - </h2> -->
                <!-- <h2 class="inline font-normal">★★★★☆</h2> -->
                <!-- <p class="font-normal text-sm indent-2">{{ author }}</p> -->
            </div>
            <div id="rating" class=""></div>
            <div id="comments" class="h-10 flex text-gruvbox-green">
                <p class="my-auto lowercase">{{ comment }}</p>
            </div>
        </div>
    </div>
</template>
