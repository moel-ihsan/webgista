import type { Session, SupabaseClient } from '@supabase/supabase-js'

import type {
  AccessIdentity,
  AppRole,
  AuthFailure,
  AuthGateway,
  AuthSession,
} from './types'

function toSession(session: Session | null): AuthSession | null {
  if (!session) return null

  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
    },
  }
}

function toFailure(error: { code?: string; message: string } | null): AuthFailure | null {
  if (!error) return null
  return { code: error.code, message: error.message }
}

function trustedRole(value: unknown): AppRole | null {
  if (value === 'administrator' || value === 'agency_editor') return value
  if (value === null || value === undefined) return null
  throw new Error('The database returned an unsupported application role.')
}

export function createSupabaseAuthGateway(client: SupabaseClient): AuthGateway {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession()
      return { session: toSession(data.session), error: toFailure(error) }
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password })
      return { session: toSession(data.session), error: toFailure(error) }
    },

    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      return toFailure(error)
    },

    async loadAccess(userId): Promise<AccessIdentity> {
      const [roleResult, membershipResult] = await Promise.all([
        client.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        client.from('agency_memberships').select('agency_id').eq('user_id', userId),
      ])

      const queryError = roleResult.error ?? membershipResult.error
      if (queryError) throw new Error('Access data could not be loaded.')

      const role = trustedRole(roleResult.data?.role)
      const agencyIds = (membershipResult.data ?? [])
        .map((membership) => membership.agency_id)
        .filter((agencyId): agencyId is string => typeof agencyId === 'string')

      return { displayName: null, role, agencyIds }
    },

    async loadDisplayName(userId) {
      const { data, error } = await client.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
      return !error && typeof data?.display_name === 'string' ? data.display_name : null
    },

    onAuthStateChange(callback) {
      let active = true
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const authSession = toSession(session)
        // Supabase auth holds an internal lock while invoking listeners; defer data queries until it releases.
        setTimeout(() => {
          if (active) callback(authSession)
        }, 0)
      })

      return () => {
        active = false
        data.subscription.unsubscribe()
      }
    },
  }
}
