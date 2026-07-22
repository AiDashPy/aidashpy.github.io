import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import General from '../views/General.vue'
import Admin from '../views/Admin.vue'

const routes = [
    {
        path: '/',
        name: 'AiDashPy',
        component: General
    },
    {
        path: '/log',
        name: 'Reading Log — AiDashPy',
        component: Home
    },
    {
        path: '/admin',
        name: 'Admin — AiDashPy',
        component: Admin
    },
    {
        path: '/qbt',
        beforeEnter() {
            window.location.href = 'https://averys-mac-mini-1.tail8e2e46.ts.net/'
        }
    },
    {
        path: '/:catchAll(.*)',
        redirect: '/'
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

router.beforeEach((to, from, next) => {
    if (to.name) document.title = to.name;
    next();
});

export default router
