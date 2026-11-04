import { createRouter, createWebHistory } from 'vue-router'

import { authSession } from '../auth/session'
import { installRouteGuards } from './guards'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../pages/DashboardPage.vue'),
      meta: { title: 'Dashboard', eyebrow: 'Dashboard' },
    },
    {
      path: '/map',
      name: 'map',
      component: () => import('../pages/MapPage.vue'),
      meta: { title: 'Map View', eyebrow: 'Web GIS' },
    },
    {
      path: '/cctv',
      name: 'cctv',
      component: () => import('../pages/CctvPage.vue'),
      meta: {
        title: 'Table View',
        eyebrow: 'Data registry',
        requiresAuth: true,
        roles: ['administrator', 'agency_editor'],
      },
    },
    {
      path: '/cctv/new',
      name: 'cctv-create',
      component: () => import('../pages/CctvFormPage.vue'),
      meta: {
        title: 'Add New CCTV',
        eyebrow: 'Data registry',
        requiresAuth: true,
        roles: ['administrator', 'agency_editor'],
      },
    },
    {
      path: '/cctv/:id/edit',
      name: 'cctv-edit',
      component: () => import('../pages/CctvFormPage.vue'),
      meta: {
        title: 'Edit CCTV',
        eyebrow: 'Data registry',
        requiresAuth: true,
        roles: ['administrator', 'agency_editor'],
      },
    },
    {
      path: '/analysis',
      name: 'analysis',
      component: () => import('../pages/AnalysisPage.vue'),
      meta: {
        title: 'Video Detail',
        eyebrow: 'Video Detail',
        requiresAuth: true,
        roles: ['administrator', 'agency_editor'],
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../pages/SettingsPage.vue'),
      meta: {
        title: 'Settings',
        eyebrow: 'Application configuration',
        requiresAuth: true,
        roles: ['administrator'],
      },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../pages/ProfilePage.vue'),
      meta: { title: 'Edit Profile', eyebrow: 'Account', requiresAuth: true },
    },
    {
      path: '/password',
      name: 'password',
      component: () => import('../pages/PasswordPage.vue'),
      meta: { title: 'Change Password', eyebrow: 'Account', requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
      meta: { title: 'Sign in', eyebrow: 'Invitation-only access' },
    },
    {
      path: '/access-denied',
      name: 'access-denied',
      component: () => import('../pages/AccessDeniedPage.vue'),
      meta: { title: 'Access denied', eyebrow: 'Authorization' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
      meta: { title: 'Page not found', eyebrow: 'WebGISTA v2' },
    },
  ],
})

installRouteGuards(router, authSession)

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'WebGISTA')} · WebGISTA v2`
})
