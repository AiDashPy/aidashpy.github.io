<script setup>
    import { RouterLink } from 'vue-router';
</script>

<script>

</script>

<template>
    <!-- <div class=" min-h-screen w-screen overflow-hidden bg-gruvboxDark-bg flex lowercase font-mono">
        <div class="grid grid-flow-col grid-rows-2 m-auto">
            <h1 class="m-auto text-gruvboxDark-fg text-7xl md:text-8xl select-none">AiDashPy</h1>
            <div class="text-gruvboxDark-fg3 flex flex-row text-sm md:text-base px-6 h-fit justify-between mt-4">
                <RouterLink to="/" target="_blank">Reading Log</RouterLink>
                <a href="https://anilist.co/user/Aidashpy/" target="_blank">Anilist</a>
                <a href="https://letterboxd.com/aidashpy/" target="_blank">Letterboxd</a>
            </div>
        </div>
    </div> -->


    <div class="bg-gruvbox-bgS lowercase font-mono flex h-dvh bg-cover bg-top" style="background-image: url('images/background.webp');">
        
        <div class="border border-gruvboxDark-fg2 shadow-xl shadow-gruvboxDark-bg bg-gruvbox-bg1 rounded-2xl flex flex-col my-auto md:mx-auto py-4 w-fit mx-2 md:w-1/2">

            <h1 class="text-gruvboxDark-bg mx-auto select-none text-4xl">aidashpy</h1>

            <!-- <img src="./images/ThePaintingNewPlanet.webp" alt="New Planet, Konstantin Yuon, 1921"> -->
            <a href="https://www.culture.ru/persons/9593/konstantin-yuon" target="_blank" class="w-5/6 mx-auto my-4">
                <img class="" src="/images/ThePaintingNewPlanet.webp" alt="New Planet, Konstantin Yuon, 1921">
            </a>

            <div class="text-gruvboxDark-bgS sm:text-lg flex flex-row justify-center gap-4 sm:gap-16 mx-10">

                <RouterLink to="/" target="_blank">reading</RouterLink>
                <a href="https://letterboxd.com/aidashpy/" target="_blank">letterboxd</a>
                <a href="https://anilist.co/user/Aidashpy/" target="_blank">anilist</a>
                
            </div>

        </div>

    </div>
</template>