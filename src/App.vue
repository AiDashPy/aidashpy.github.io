<script setup>
  import WebHeader from './components/WebHeader.vue'
  import BookEntry from './components/BookEntry.vue'
  import WebFooter from './components/WebFooter.vue'
</script>

<template>
  <div class="flex flex-col justify-between min-h-screen">
    <WebHeader  />

    <div class="lg:mx-56 grow">

      <div class="py-6 rounded-2xl w-full flex flex-row flex-wrap">
        <BookEntry title="How To Hide An Empire" author="Daniel Immerwahr" comment="mgaow">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1627757585i/40121985.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="The Hundred Years' War on Palestine" author="Rashid Khalidi" comment="mgaow">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1556345491i/41812831.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Washington Bullets" author="Vijay Prashad" comment="mgaow">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1688675066i/54169138.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Abolish Rent" author="Tracy Rosenthal & Leonardo Vilchis" comment="mgaow">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1718715847i/205900042.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Western Marxism" author="Domenico Losurdo" comment="mgaow">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1719720774i/200300090.jpg" alt="Generic Book Cover">
        </BookEntry>
        
      </div>
    </div>


    <WebFooter />
  </div>
</template>