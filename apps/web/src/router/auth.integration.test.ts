import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { createAuthSession } from '../auth/session'
import type { AccessIdentity, AuthGateway, AuthSession } from '../auth/types'
import { redirectAfterLogin } from './access'
import { installRouteGuards } from './guards'

const page = defineComponent({ render: () => h('div') })
const session: AuthSession = { user: { id: 'editor-1', email: 'editor@example.test' } }
const editor: AccessIdentity = { displayName: null, role: 'agency_editor', agencyIds: ['agency-1'] }

function createGateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    getSession: vi.fn().mockResolvedValue({ session: null, error: null }),
    signIn: vi.fn().mockResolvedValue({ session, error: null }),
    signOut: vi.fn().mockResolvedValue(null),
    loadAccess: vi.fn().mockResolvedValue(editor),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  }
}

function createTestRouter(auth: ReturnType<typeof createAuthSession>) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: page },
      { path: '/login', name: 'login', component: page },
      { path: '/cctv', name: 'cctv', component: page, meta: { requiresAuth: true, roles: ['administrator', 'agency_editor'] } },
      { path: '/settings', name: 'settings', component: page, meta: { requiresAuth: true, roles: ['administrator'] } },
      { path: '/profile', name: 'profile', component: page, meta: { requiresAuth: true } },
      { path: '/password', name: 'password', component: page, meta: { requiresAuth: true } },
      { path: '/access-denied', name: 'access-denied', component: page },
    ],
  })
  installRouteGuards(router, auth)
  return router
}

describe('authentication and router integration', () => {
  it('waits for trusted role loading, then redirects successful login to the requested route', async () => {
    let resolveAccess: (identity: AccessIdentity) => void = () => undefined
    const access = new Promise<AccessIdentity>((resolve) => { resolveAccess = resolve })
    const auth = createAuthSession(createGateway({ loadAccess: vi.fn(() => access) }))
    await auth.initialize()
    const router = createTestRouter(auth)

    await router.push('/cctv')
    expect(router.currentRoute.value.name).toBe('login')
    const redirect = router.currentRoute.value.query.redirect
    const login = auth.login('editor@example.test', 'valid-password')
    expect(auth.state.status).toBe('loading')
    resolveAccess(editor)
    await expect(login).resolves.toBe(true)
    await redirectAfterLogin(router, true, redirect)

    expect(router.currentRoute.value.name).toBe('cctv')
  })

  it('routes successful login without a return URL to the canonical Dashboard route', async () => {
    const auth = createAuthSession(createGateway())
    await auth.initialize()
    const router = createTestRouter(auth)
    await router.push('/login')

    const signedIn = await auth.login('editor@example.test', 'valid-password')
    await redirectAfterLogin(router, signedIn, undefined)

    expect(router.currentRoute.value.name).toBe('dashboard')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('redirects an already authenticated user away from Login without a loop', async () => {
    const auth = createAuthSession(createGateway({
      getSession: vi.fn().mockResolvedValue({ session, error: null }),
    }))
    await auth.initialize()
    const router = createTestRouter(auth)

    await router.push('/login')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('keeps failed login on Login and denies a role-incompatible return route', async () => {
    const signIn = vi.fn()
      .mockResolvedValueOnce({ session: null, error: { message: 'invalid credentials' } })
      .mockResolvedValueOnce({ session, error: null })
    const auth = createAuthSession(createGateway({
      signIn,
    }))
    await auth.initialize()
    const router = createTestRouter(auth)

    await router.push('/login')
    const failed = await auth.login('editor@example.test', 'wrong-password')
    await redirectAfterLogin(router, failed, undefined)
    expect(router.currentRoute.value.name).toBe('login')

    const signedIn = await auth.login('editor@example.test', 'valid-password')
    await redirectAfterLogin(router, signedIn, undefined)
    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('access-denied')
  })

  it('rejects an external post-login destination and returns to Dashboard', async () => {
    const auth = createAuthSession(createGateway())
    await auth.initialize()
    const router = createTestRouter(auth)
    await router.push('/login')
    const signedIn = await auth.login('editor@example.test', 'valid-password')

    await redirectAfterLogin(router, signedIn, 'https://example.invalid')

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('protects both original account destinations and permits the authenticated user', async () => {
    const auth = createAuthSession(createGateway())
    await auth.initialize()
    const router = createTestRouter(auth)
    await router.push('/profile')
    expect(router.currentRoute.value.name).toBe('login')
    await auth.login('editor@example.test', 'valid-password')
    await router.push('/profile')
    expect(router.currentRoute.value.name).toBe('profile')
    await router.push('/password')
    expect(router.currentRoute.value.name).toBe('password')
  })
})
