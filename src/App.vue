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
        <BookEntry title="How To Hide An Empire" author="Daniel Immerwahr" comment="Started 10/30/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1627757585i/40121985.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="The Hundred Years' War on Palestine" author="Rashid Khalidi" comment="Finished 10/29/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1556345491i/41812831.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Washington Bullets" author="Vijay Prashad" comment="Finished 10/26/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1688675066i/54169138.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Abolish Rent" author="Tracy Rosenthal & Leonardo Vilchis" comment="Finished 10/20/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1718715847i/205900042.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Western Marxism" author="Domenico Losurdo" comment="Finished 10/14/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1719720774i/200300090.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="The Wretched Of The Earth" author="Frantz Fanon" comment="Finished 07/09/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1704228247i/66933.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Roadside Picnic" author="Arkady & Boris Strugatsky" comment="Finished 07/03/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1173812259i/331256.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Solaris" author="Stanisław Lem" comment="Finished 06/17/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1498631519i/95558.jpg" alt="Generic Book Cover">
        </BookEntry>
        <BookEntry title="Liberalism: A Counter-History" author="Domenico Losurdo" comment="Finished 05/16/2024">
          <img class="max-h-40 rounded-xl" src="https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1373998827i/9670246.jpg" alt="Generic Book Cover">
        </BookEntry>


        
      </div>
    </div>


    <WebFooter />
  </div>
</template>