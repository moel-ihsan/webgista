import { describe, expect, it } from 'vitest'

import { authenticatedLoginRedirect, resolveRouteAccess, safeInternalRedirect } from './access'

describe('route access decisions', () => {
  it('redirects an unauthenticated visitor away from private routes', () => {
    expect(
      resolveRouteAccess(
        { requiresAuth: true, roles: ['administrator', 'agency_editor'] },
        'anonymous',
        null,
      ),
    ).toBe('login')
  })

  it('allows administrators into administrator routes', () => {
    expect(
      resolveRouteAccess({ requiresAuth: true, roles: ['administrator'] }, 'authenticated', 'administrator'),
    ).toBe('allow')
  })

  it('denies agency editors access to administrator routes', () => {
    expect(
      resolveRouteAccess({ requiresAuth: true, roles: ['administrator'] }, 'authenticated', 'agency_editor'),
    ).toBe('denied')
  })

  it('denies a signed-in user without a trusted database role', () => {
    expect(
      resolveRouteAccess(
        { requiresAuth: true, roles: ['administrator', 'agency_editor'] },
        'authenticated',
        null,
      ),
    ).toBe('denied')
  })

  it('does not treat a failed access lookup as an authenticated private route', () => {
    expect(resolveRouteAccess({ requiresAuth: true }, 'error', null)).toBe('login')
  })

  it('accepts only internal post-login redirects', () => {
    expect(safeInternalRedirect('/cctv?filter=active')).toBe('/cctv?filter=active')
    expect(safeInternalRedirect('//attacker.example')).toBe('/')
    expect(safeInternalRedirect('https://attacker.example')).toBe('/')
    expect(safeInternalRedirect('/login?redirect=/settings')).toBe('/')
  })

  it('sends authenticated login visits to a safe destination and leaves other states alone', () => {
    expect(authenticatedLoginRedirect('authenticated', undefined)).toEqual({ name: 'dashboard' })
    expect(authenticatedLoginRedirect('authenticated', '/cctv/new')).toBe('/cctv/new')
    expect(authenticatedLoginRedirect('authenticated', '//outside.example')).toEqual({ name: 'dashboard' })
    expect(authenticatedLoginRedirect('loading', '/settings')).toBeNull()
    expect(authenticatedLoginRedirect('anonymous', '/settings')).toBeNull()
  })
})
