import type { Router } from 'vue-router'

import type { AuthState } from '../auth/session'
import { authenticatedLoginRedirect, resolveRouteAccess } from './access'

type GuardSession = {
  state: Pick<AuthState, 'status' | 'role'>
  whenReady(): Promise<void>
}

export function installRouteGuards(router: Router, session: GuardSession): void {
  router.beforeEach(async (to) => {
    await session.whenReady()

    if (to.name === 'login') {
      const destination = authenticatedLoginRedirect(session.state.status, to.query.redirect)
      if (destination) return destination
    }

    const decision = resolveRouteAccess(to.meta, session.state.status, session.state.role)
    if (decision === 'login') {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (decision === 'denied') {
      return { name: 'access-denied' }
    }

    return true
  })
}
