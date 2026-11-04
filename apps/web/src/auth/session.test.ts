import { describe, expect, it, vi } from 'vitest'

import { createAuthSession } from './session'
import type { AccessIdentity, AuthGateway, AuthSession } from './types'

const userSession: AuthSession = {
  user: { id: 'user-1', email: 'editor@example.test' },
}

const editorAccess: AccessIdentity = {
  displayName: 'Agency Editor',
  role: 'agency_editor',
  agencyIds: ['agency-1'],
}

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    getSession: vi.fn().mockResolvedValue({ session: null, error: null }),
    signIn: vi.fn().mockResolvedValue({ session: userSession, error: null }),
    signOut: vi.fn().mockResolvedValue(null),
    loadAccess: vi.fn().mockResolvedValue(editorAccess),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  }
}

describe('authentication session controller', () => {
  it('restores a persisted session and trusted access data', async () => {
    const auth = createAuthSession(
      gateway({ getSession: vi.fn().mockResolvedValue({ session: userSession, error: null }) }),
    )

    await auth.initialize()

    expect(auth.state).toMatchObject({
      status: 'authenticated',
      user: userSession.user,
      displayName: 'Agency Editor',
      role: 'agency_editor',
      agencyIds: ['agency-1'],
    })
  })

  it('signs in with email and password', async () => {
    const mockGateway = gateway()
    const auth = createAuthSession(mockGateway)
    await auth.initialize()

    await expect(auth.login('editor@example.test', 'valid-password')).resolves.toBe(true)
    expect(mockGateway.signIn).toHaveBeenCalledWith('editor@example.test', 'valid-password')
    expect(auth.state.status).toBe('authenticated')
    expect(auth.state.role).toBe('agency_editor')
  })

  it('does not block login on the optional profile display-name request', async () => {
    let resolveDisplayName: (name: string | null) => void = () => undefined
    const displayName = new Promise<string | null>((resolve) => { resolveDisplayName = resolve })
    const auth = createAuthSession(gateway({
      loadAccess: vi.fn().mockResolvedValue({ ...editorAccess, displayName: null }),
      loadDisplayName: vi.fn(() => displayName),
    }))
    await auth.initialize()

    await expect(auth.login('editor@example.test', 'valid-password')).resolves.toBe(true)
    expect(auth.state).toMatchObject({ status: 'authenticated', role: 'agency_editor', displayName: null })

    resolveDisplayName('Agency Editor')
    await Promise.resolve()
    expect(auth.state.displayName).toBe('Agency Editor')
  })

  it('does not restore a late profile name after logout', async () => {
    let resolveDisplayName: (name: string | null) => void = () => undefined
    const displayName = new Promise<string | null>((resolve) => { resolveDisplayName = resolve })
    const auth = createAuthSession(gateway({
      loadAccess: vi.fn().mockResolvedValue({ ...editorAccess, displayName: null }),
      loadDisplayName: vi.fn(() => displayName),
    }))
    await auth.initialize()
    await auth.login('editor@example.test', 'valid-password')
    await auth.logout()

    resolveDisplayName('Stale profile')
    await Promise.resolve()
    expect(auth.state).toMatchObject({ status: 'anonymous', user: null, displayName: null, role: null })
  })

  it('refreshes the displayed profile name without changing the authenticated session or role', async () => {
    const auth = createAuthSession(gateway({ loadDisplayName: vi.fn().mockResolvedValue('Updated Name') }))
    await auth.initialize()
    await auth.login('editor@example.test', 'valid-password')
    await auth.refreshDisplayName()
    expect(auth.state).toMatchObject({ status: 'authenticated', user: userSession.user, displayName: 'Updated Name', role: 'agency_editor' })
  })

  it('waits for trusted role data before finishing login authorization', async () => {
    let resolveAccess: (identity: AccessIdentity) => void = () => undefined
    const access = new Promise<AccessIdentity>((resolve) => { resolveAccess = resolve })
    const auth = createAuthSession(gateway({ loadAccess: vi.fn(() => access) }))
    await auth.initialize()

    let finished = false
    const login = auth.login('editor@example.test', 'valid-password').then((value) => { finished = true; return value })
    await Promise.resolve()
    expect(auth.state.status).toBe('loading')
    expect(finished).toBe(false)

    resolveAccess(editorAccess)
    await expect(login).resolves.toBe(true)
    expect(auth.state.role).toBe('agency_editor')
  })

  it('does not let the deferred Supabase sign-in event invalidate the login access lookup', async () => {
    let emitAuthChange: (session: AuthSession | null) => void = () => undefined
    let resolveAccess: (identity: AccessIdentity) => void = () => undefined
    const access = new Promise<AccessIdentity>((resolve) => { resolveAccess = resolve })
    const mockGateway = gateway({
      signIn: vi.fn(async () => {
        setTimeout(() => emitAuthChange(userSession), 0)
        return { session: userSession, error: null }
      }),
      loadAccess: vi.fn(() => access),
      onAuthStateChange: vi.fn((callback) => {
        emitAuthChange = callback
        return () => undefined
      }),
    })
    const auth = createAuthSession(mockGateway)
    await auth.initialize()

    const login = auth.login('editor@example.test', 'valid-password')
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(mockGateway.loadAccess).toHaveBeenCalledOnce()

    resolveAccess(editorAccess)
    await expect(login).resolves.toBe(true)
    expect(auth.state).toMatchObject({ status: 'authenticated', role: 'agency_editor' })
  })

  it('returns a useful message for invalid credentials', async () => {
    const auth = createAuthSession(
      gateway({
        signIn: vi.fn().mockResolvedValue({
          session: null,
          error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
        }),
      }),
    )
    await auth.initialize()

    await expect(auth.login('editor@example.test', 'wrong-password')).resolves.toBe(false)
    expect(auth.state.status).toBe('anonymous')
    expect(auth.state.errorMessage).toBe('Email or password is incorrect.')
  })

  it('signs out locally and clears all access state', async () => {
    const mockGateway = gateway({
      getSession: vi.fn().mockResolvedValue({ session: userSession, error: null }),
    })
    const auth = createAuthSession(mockGateway)
    await auth.initialize()

    await expect(auth.logout()).resolves.toBe(true)
    expect(mockGateway.signOut).toHaveBeenCalledOnce()
    expect(auth.state).toMatchObject({
      status: 'anonymous',
      user: null,
      role: null,
      agencyIds: [],
    })
  })

  it('reacts to an expired or externally signed-out session', async () => {
    let emitAuthChange: (session: AuthSession | null) => void = () => undefined
    const auth = createAuthSession(
      gateway({
        getSession: vi.fn().mockResolvedValue({ session: userSession, error: null }),
        onAuthStateChange: vi.fn((callback) => {
          emitAuthChange = callback
          return () => undefined
        }),
      }),
    )
    await auth.initialize()

    emitAuthChange(null)
    await Promise.resolve()

    expect(auth.state.status).toBe('anonymous')
    expect(auth.state.user).toBeNull()
  })

  it('does not restore stale access data after a session expires', async () => {
    let emitAuthChange: (session: AuthSession | null) => void = () => undefined
    let finishAccess: (identity: AccessIdentity) => void = () => undefined
    let markAccessStarted: () => void = () => undefined
    const accessStarted = new Promise<void>((resolve) => {
      markAccessStarted = resolve
    })
    const access = new Promise<AccessIdentity>((resolve) => {
      finishAccess = resolve
    })
    const auth = createAuthSession(
      gateway({
        getSession: vi.fn().mockResolvedValue({ session: userSession, error: null }),
        loadAccess: vi.fn(() => {
          markAccessStarted()
          return access
        }),
        onAuthStateChange: vi.fn((callback) => {
          emitAuthChange = callback
          return () => undefined
        }),
      }),
    )

    const initializing = auth.initialize()
    await accessStarted
    emitAuthChange(null)
    finishAccess(editorAccess)
    await initializing

    expect(auth.state.status).toBe('anonymous')
    expect(auth.state.role).toBeNull()
  })

  it('exposes loading and access-verification error states', async () => {
    let rejectAccess: (reason?: unknown) => void = () => undefined
    const access = new Promise<AccessIdentity>((_resolve, reject) => {
      rejectAccess = reject
    })
    const auth = createAuthSession(
      gateway({
        getSession: vi.fn().mockResolvedValue({ session: userSession, error: null }),
        loadAccess: vi.fn().mockReturnValue(access),
      }),
    )

    const initializing = auth.initialize()
    await Promise.resolve()
    expect(auth.state.status).toBe('loading')

    rejectAccess(new Error('database unavailable'))
    await initializing
    expect(auth.state.status).toBe('error')
    expect(auth.state.errorMessage).toBe('Your account access could not be verified.')
  })

  it('remains usable for public pages when configuration is missing', async () => {
    const auth = createAuthSession(null, 'Missing public configuration.')
    await auth.initialize()

    expect(auth.state.status).toBe('unconfigured')
    expect(auth.state.errorMessage).toBe('Missing public configuration.')
    await expect(auth.login('user@example.test', 'password')).resolves.toBe(false)
  })
})
