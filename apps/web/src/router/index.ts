import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../pages/DashboardPage.vue'),
      meta: { title: 'Dashboard', eyebrow: 'System overview' },
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../pages/MapPage.vue'),
      meta: { title: 'Traffic map', eyebrow: 'Web GIS' },
    },
    {
      path: '/cctv',
      name: 'cctv',
      component: () => import('../pages/CctvPage.vue'),
      meta: { title: 'CCTV management', eyebrow: 'Data registry' },
    },
    {
      path: '/analysis',
      name: 'analysis',
      component: () => import('../pages/AnalysisPage.vue'),
      meta: { title: 'Traffic analysis', eyebrow: 'Research workspace' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../pages/SettingsPage.vue'),
      meta: { title: 'Settings', eyebrow: 'Application configuration' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
      meta: { title: 'Page not found', eyebrow: 'WebGISTA v2' },
    },
  ],
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'WebGISTA')} · WebGISTA v2`
})
