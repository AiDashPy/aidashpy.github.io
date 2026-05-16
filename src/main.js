// import Vue from 'vue';
import { createApp } from 'vue'
import './index.css'
import '@fontsource-variable/bricolage-grotesque'
import App from './App.vue'
import router from './router'

createApp(App).use(router).mount('#app')

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
