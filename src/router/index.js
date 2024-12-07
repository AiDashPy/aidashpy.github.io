import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Planning from '../views/Planning.vue'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home
    },
    {
        path: '/planning',
        name: 'Planning',
        component: Planning
    },
    {
        // path: "*",
        path: "/:catchAll(.*)",
        name: "NotFound",
        component: Home,
    }
]

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes
})

export default router