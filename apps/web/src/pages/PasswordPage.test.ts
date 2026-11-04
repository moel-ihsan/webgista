// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { changeOwnPassword } = vi.hoisted(() => ({ changeOwnPassword: vi.fn() }))

vi.mock('../auth/session', () => ({ authSession: { state: { user: { id: 'user-1', email: 'user@example.test' } } } }))
vi.mock('../lib/supabase', () => ({ supabaseClient: {} }))
vi.mock('../data/account', () => ({ changeOwnPassword }))

import PasswordPage from './PasswordPage.vue'

let app: ReturnType<typeof createApp> | undefined
let host: HTMLDivElement | undefined

async function mountPage() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/password', component: PasswordPage }, { path: '/', component: { template: '<div />' } }] })
  await router.push('/password')
  await router.isReady()
  host = document.createElement('div')
  app = createApp(RouterView)
  app.use(router)
  app.mount(host)
  await nextTick()
  return host
}

async function enterPasswords(root: HTMLElement) {
  for (const [selector, value] of [['#current-password', 'old-password'], ['#new-password', 'new-password'], ['#confirm-password', 'new-password']] as const) {
    const input = root.querySelector<HTMLInputElement>(selector)!
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  await nextTick()
}

afterEach(() => {
  app?.unmount()
  host?.remove()
  app = undefined
  host = undefined
  changeOwnPassword.mockReset()
})

describe('Change Password feedback', () => {
  it('clears fields and visibly confirms success while preserving the page', async () => {
    changeOwnPassword.mockResolvedValue(undefined)
    const root = await mountPage()
    await enterPasswords(root)
    root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()
    await Promise.resolve()
    await nextTick()
    expect(root.querySelector('.account-success')?.textContent).toContain('Password updated')
    expect(root.querySelector('.account-success')?.textContent).toContain('current session remains active')
    expect([...root.querySelectorAll<HTMLInputElement>('input[type="password"]')].every(({ value }) => value === '')).toBe(true)
    expect(root.querySelector('#current-password')).not.toBeNull()
  })

  it('prevents duplicate submissions and reports a safe error', async () => {
    let resolve: (() => void) | undefined
    changeOwnPassword.mockImplementation(() => new Promise<void>((done) => { resolve = done }))
    const root = await mountPage()
    await enterPasswords(root)
    const form = root.querySelector('form')!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(changeOwnPassword).toHaveBeenCalledOnce()
    expect(root.textContent).toContain('Updating password…')
    resolve?.()
    await Promise.resolve()
    await nextTick()

    changeOwnPassword.mockRejectedValueOnce(new Error('Current password could not be verified.'))
    await enterPasswords(root)
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
    await nextTick()
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('could not be verified')
  })
})
