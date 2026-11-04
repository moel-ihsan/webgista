// @vitest-environment happy-dom
import { createApp, defineComponent, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../auth/session', () => ({
  authSession: { state: { status: 'authenticated', displayName: 'WebGISTA User', user: { email: 'user@example.test' } } },
}))

import TopNavigation from './TopNavigation.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

afterEach(() => {
  if (app?._container) app.unmount()
  host?.remove()
  app = undefined
  host = undefined
  vi.unstubAllGlobals()
})

describe('account navigation', () => {
  it('restores Edit Profile and Change Password in the authenticated header dropdown', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: defineComponent({ template: '<div />' }) },
        { path: '/profile', component: defineComponent({ template: '<div />' }) },
        { path: '/password', component: defineComponent({ template: '<div />' }) },
      ],
    })
    await router.push('/')
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
    host = document.createElement('div')
    app = createApp(TopNavigation, { navigationOpen: false })
    app.use(router)
    app.mount(host)
    await nextTick()

    expect([...host.querySelectorAll('.account-menu__items a')].map((link) => [link.textContent?.trim(), link.getAttribute('href')]))
      .toEqual([['Edit Profile', '/profile'], ['Change Password', '/password']])
  })
})
