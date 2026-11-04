interface SupabaseEnvironment {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export interface SupabaseConfig {
  available: boolean
  url: string | null
  publishableKey: string | null
  error: string | null
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return true
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function isPrivilegedKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true

  const encodedPayload = value.split('.')[1]
  if (!encodedPayload || typeof globalThis.atob !== 'function') return false

  try {
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
    const payload: unknown = JSON.parse(globalThis.atob(`${normalized}${padding}`))
    return typeof payload === 'object' && payload !== null && 'role' in payload
      ? payload.role === 'service_role'
      : false
  } catch {
    return false
  }
}

export function readSupabaseConfig(environment: SupabaseEnvironment): SupabaseConfig {
  const url = environment.VITE_SUPABASE_URL?.trim() ?? ''
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''

  if (!url || !publishableKey) {
    return {
      available: false,
      url: null,
      publishableKey: null,
      error: 'Supabase authentication is not configured for this build.',
    }
  }

  if (!validHttpUrl(url)) {
    return {
      available: false,
      url: null,
      publishableKey: null,
      error: 'The configured Supabase URL is invalid.',
    }
  }

  if (isPrivilegedKey(publishableKey)) {
    return {
      available: false,
      url: null,
      publishableKey: null,
      error: 'A secret Supabase key cannot be used in the browser.',
    }
  }

  return {
    available: true,
    url,
    publishableKey,
    error: null,
  }
}

export const supabaseConfig = readSupabaseConfig(import.meta.env)
