import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { pinia } from '../stores'
import { useUserStore } from '../stores/user'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login/index.vue'),
    meta: { guestOnly: true, title: '登录' },
  },
  {
    path: '/',
    name: 'home',
    component: () => import('../views/device-management/index.vue'),
    meta: { requiresAuth: true, title: '设备管理系统' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../components/App.vue'),
    meta: { requiresAuth: true, title: '数据总览' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes })

router.beforeEach((to) => {
  const userStore = useUserStore(pinia)
  if (to.meta.requiresAuth && !userStore.accessToken) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && userStore.accessToken) return { name: 'home' }
  return true
})

export default router
