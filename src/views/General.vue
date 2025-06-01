<script setup>
import { RouterLink } from "vue-router";
</script>

<script>
export default {
    data() {
        return {
            created: false,
        };
    },
    mounted() {
        this.created = true;
    },
};
</script>

<template>
    <div
        class="bg-gruvbox-bgS lowercase font-mono flex h-dvh bg-cover bg-top"
        style="background-image: url(&quot;images/backgroundnew.webp&quot;)"
    >
        <Transition
            enter-active-class="duration-1000 ease-out"
            enter-from-class="transform opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="duration-1000 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="transform opacity-0"
        >
            <div
                v-if="created"
                class="border border-gruvboxDark-fg2 shadow-xl shadow-gruvboxDark-bg bg-gruvbox-bg1 rounded-2xl flex flex-col my-auto md:mx-auto py-4 mx-2 md:w-1/2"
            >
                <h1 class="text-gruvboxDark-bg mx-auto select-none text-4xl">
                    aidashpy
                </h1>

                <a
                    href="https://www.culture.ru/persons/9593/konstantin-yuon"
                    target="_blank"
                    class="w-5/6 mx-auto my-4"
                >
                    <img
                        class="w-full"
                        src="/images/ThePaintingNewPlanetNew.webp"
                        alt="New Planet, Konstantin Yuon, 1921"
                    />
                </a>

                <div
                    class="text-gruvboxDark-bgS md:text-lg flex flex-row justify-center gap-4 md:gap-16 mx-10"
                >
                    <RouterLink to="/" target="_blank">reading</RouterLink>
                    <a href="https://letterboxd.com/aidashpy/" target="_blank"
                        >letterboxd</a
                    >
                    <a href="https://anilist.co/user/Aidashpy/" target="_blank"
                        >anilist</a
                    >
                </div>
            </div>
        </Transition>
    </div>
</template>
