import type { AppRole, AuthStatus } from '../auth/types'
import type { RouteLocationRaw, Router } from 'vue-router'

export interface RouteAccess {
  requiresAuth?: boolean
  roles?: readonly AppRole[]
}

export type AccessDecision = 'allow' | 'login' | 'denied'

export function resolveRouteAccess(
  access: RouteAccess,
  status: AuthStatus,
  role: AppRole | null,
): AccessDecision {
  if (!access.requiresAuth) return 'allow'
  if (status !== 'authenticated') return 'login'
  if (access.roles?.length && (role === null || !access.roles.includes(role))) return 'denied'
  return 'allow'
}

export function safeInternalRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (value === '/login' || value.startsWith('/login?')) return fallback
  return value
}

export function authenticatedLoginRedirect(status: AuthStatus, value: unknown): RouteLocationRaw | null {
  if (status !== 'authenticated') return null
  const destination = safeInternalRedirect(value)
  return destination === '/' ? { name: 'dashboard' } : destination
}

export async function redirectAfterLogin(
  router: Pick<Router, 'replace'>,
  signedIn: boolean,
  value: unknown,
): Promise<void> {
  if (!signedIn) return
  const destination = authenticatedLoginRedirect('authenticated', value)
  if (destination) await router.replace(destination)
}
