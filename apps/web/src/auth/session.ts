import { reactive } from 'vue'

import { supabaseConfig } from '../config/supabase'
import { supabaseClient } from '../lib/supabase'
import { createSupabaseAuthGateway } from './supabaseGateway'
import type {
  AccessIdentity,
  AppRole,
  AuthFailure,
  AuthGateway,
  AuthSession,
  AuthStatus,
  AuthUser,
} from './types'

export interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  displayName: string | null
  role: AppRole | null
  agencyIds: readonly string[]
  errorMessage: string | null
}

function friendlyAuthError(error: AuthFailure, action: 'login' | 'logout' | 'session'): string {
  const normalized = `${error.code ?? ''} ${error.message}`.toLowerCase()

  if (normalized.includes('invalid login') || normalized.includes('invalid credentials')) {
    return 'Email or password is incorrect.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'This account has not confirmed its email address.'
  }
  if (normalized.includes('fetch') || normalized.includes('network')) {
    return 'Authentication service is currently unreachable.'
  }
  if (action === 'logout') return 'Sign out could not be completed. Please try again.'
  if (action === 'session') return 'Your session could not be restored. Please sign in again.'
  return 'Sign in failed. Check your credentials and try again.'
}

export function createAuthSession(
  gateway: AuthGateway | null,
  configurationError = 'Supabase authentication is not configured for this build.',
) {
  const state = reactive<AuthState>({
    status: 'loading',
    user: null,
    displayName: null,
    role: null,
    agencyIds: [],
    errorMessage: null,
  })

  let initialized = false
  let sessionRevision = 0
  let pendingAccess: { userId: string; promise: Promise<AuthStatus> } | null = null
  let unsubscribe: (() => void) | null = null
  let resolveReady: () => void = () => undefined
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })

  function clearAccess(): void {
    state.displayName = null
    state.role = null
    state.agencyIds = []
  }

  function applySession(session: AuthSession | null): Promise<AuthStatus> {
    if (session && state.status === 'authenticated' && state.user?.id === session.user.id) {
      return Promise.resolve(state.status)
    }
    if (session && pendingAccess?.userId === session.user.id) return pendingAccess.promise

    const revision = ++sessionRevision
    state.errorMessage = null

    if (!session) {
      state.user = null
      clearAccess()
      state.status = 'anonymous'
      return Promise.resolve(state.status)
    }

    state.status = 'loading'
    state.user = session.user
    clearAccess()

    const promise = Promise.resolve().then(async () => {
      try {
        const identity: AccessIdentity = await gateway!.loadAccess(session.user.id)
        if (revision !== sessionRevision) return state.status
        state.displayName = identity.displayName
        state.role = identity.role
        state.agencyIds = identity.agencyIds
        state.status = 'authenticated'
        const loadDisplayName = gateway?.loadDisplayName
        if (loadDisplayName) {
          void loadDisplayName(session.user.id).then((displayName) => {
            if (revision === sessionRevision && state.status === 'authenticated' && state.user?.id === session.user.id) {
              state.displayName = displayName
            }
          }).catch(() => undefined)
        }
      } catch {
        if (revision !== sessionRevision) return state.status
        state.status = 'error'
        state.errorMessage = 'Your account access could not be verified.'
      } finally {
        if (pendingAccess?.promise === promise) pendingAccess = null
      }

      return state.status
    })
    pendingAccess = { userId: session.user.id, promise }
    return promise
  }

  async function initialize(): Promise<void> {
    if (initialized) return ready
    initialized = true

    if (!gateway) {
      state.status = 'unconfigured'
      state.errorMessage = configurationError
      resolveReady()
      return
    }

    let eventRevision = 0
    let latestEvent: Promise<unknown> = Promise.resolve()
    try {
      unsubscribe = gateway.onAuthStateChange((session) => {
        eventRevision += 1
        latestEvent = applySession(session)
      })

      const revisionBeforeRequest = eventRevision
      const result = await gateway.getSession()
      if (revisionBeforeRequest === eventRevision) {
        if (result.error) {
          state.status = 'error'
          state.errorMessage = friendlyAuthError(result.error, 'session')
        } else {
          await applySession(result.session)
        }
      } else {
        await latestEvent
      }
    } catch {
      state.status = 'error'
      state.errorMessage = 'Your session could not be restored. Please sign in again.'
    } finally {
      resolveReady()
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    if (!gateway) {
      state.status = 'unconfigured'
      state.errorMessage = configurationError
      return false
    }

    state.status = 'loading'
    state.errorMessage = null

    try {
      const result = await gateway.signIn(email, password)
      if (result.error || !result.session) {
        state.status = 'anonymous'
        state.errorMessage = result.error
          ? friendlyAuthError(result.error, 'login')
          : 'Sign in did not return a valid session.'
        return false
      }

      const status = await applySession(result.session)
      return status === 'authenticated'
    } catch {
      state.status = 'anonymous'
      state.errorMessage = 'Authentication service is currently unreachable.'
      return false
    }
  }

  async function logout(): Promise<boolean> {
    if (!gateway) return true

    const previousStatus = state.status
    state.status = 'loading'
    state.errorMessage = null

    try {
      const error = await gateway.signOut()
      if (error) {
        state.status = previousStatus
        state.errorMessage = friendlyAuthError(error, 'logout')
        return false
      }

      await applySession(null)
      return true
    } catch {
      state.status = previousStatus
      state.errorMessage = 'Sign out could not be completed. Please try again.'
      return false
    }
  }

  function canAccess(roles?: readonly AppRole[]): boolean {
    if (!roles?.length) return true
    return state.status === 'authenticated' && state.role !== null && roles.includes(state.role)
  }

  async function refreshDisplayName(): Promise<void> {
    const userId = state.user?.id
    if (!userId || !gateway?.loadDisplayName) return
    const name = await gateway.loadDisplayName(userId)
    if (state.status === 'authenticated' && state.user?.id === userId) state.displayName = name
  }

  function dispose(): void {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    state,
    initialize,
    whenReady: () => ready,
    login,
    logout,
    canAccess,
    refreshDisplayName,
    dispose,
  }
}

const gateway = supabaseClient ? createSupabaseAuthGateway(supabaseClient) : null

export const authSession = createAuthSession(gateway, supabaseConfig.error ?? undefined)
