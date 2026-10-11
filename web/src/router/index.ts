import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history: GitHub Pages has no server-side rewrites for deep links.
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'today', component: () => import('@/views/TodayView.vue') },
    { path: '/plan', name: 'plan', component: () => import('@/views/PlanView.vue') },
    { path: '/print/:view', name: 'print', component: () => import('@/views/PrintView.vue') },
    { path: '/rescue', name: 'rescue', component: () => import('@/views/RescueView.vue') },
    { path: '/shopping', name: 'shopping', component: () => import('@/views/ShoppingView.vue') },
    { path: '/meals', name: 'meals', component: () => import('@/views/MealsView.vue') },
    { path: '/setup', name: 'setup', component: () => import('@/views/SetupView.vue') },
  ],
})

export default router
