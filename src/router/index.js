import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import General from '../views/General.vue'

const routes = [
    {
        path: '/',
        name: 'reading log',
        component: Home
    },
    {
        path: '/links',
        name: "aidashpy - links",
        component: General
    },
    {
        // path: "*",
        path: "/:catchAll(.*)",
        name: "reading log",
        component: Home,
    }
]

const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes
})

router.beforeEach((to, from, next) => {
    document.title = to.name;
    next();
});

export default router