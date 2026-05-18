import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import General from '../views/General.vue'
import Admin from '../views/Admin.vue'

const routes = [
    {
        path: '/',
        name: 'Reading Log — AiDashPy',
        component: Home
    },
    {
        path: '/links',
        name: 'AiDashPy — Links',
        component: General
    },
    {
        path: '/admin',
        name: 'Admin — AiDashPy',
        component: Admin
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
