<script setup>

</script>

<script>
    export default {
        data() {
            return {
                searchThis: ''
            }
        }    
    }
</script>

<template>
    <div class="flex flex-row">
        <input type="text" name="" id="" placeholder="search goodreads" v-model="searchThis" class="bg-gruvbox-dark-fg pl-1 pb-0.5">
        <a class="bg-gruvbox-dark-fg border-l border-gruvbox-dark-fg2 px-2 pb-0.5 select-none cursor-pointer" :href="'https://www.goodreads.com/search?q='+searchThis+'&ref=nav_sb_noss_l_5'" target="_blank">search</a>
    </div>
</template>