import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import General from '../views/General.vue'
import Admin from '../views/Admin.vue'

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
        path: '/admin',
        name: 'admin',
        component: Admin
    },
    {
        path: "/:catchAll(.*)",
        name: "reading log",
        component: Home,
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

router.beforeEach((to, from, next) => {
    document.title = to.name;
    next();
});

export default router