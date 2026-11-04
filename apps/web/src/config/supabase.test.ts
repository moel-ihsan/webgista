import { describe, expect, it } from 'vitest'

import { readSupabaseConfig } from './supabase'

describe('Supabase browser configuration', () => {
  it('accepts a project URL and publishable key', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toMatchObject({ available: true, error: null })
  })

  it('handles missing configuration without throwing', () => {
    expect(readSupabaseConfig({})).toEqual({
      available: false,
      url: null,
      publishableKey: null,
      error: 'Supabase authentication is not configured for this build.',
    })
  })

  it('rejects plaintext remote project URLs', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://project.example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toMatchObject({ available: false, error: 'The configured Supabase URL is invalid.' })
  })

  it('rejects secret browser keys', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_allowed',
      }),
    ).toMatchObject({ available: false, error: 'A secret Supabase key cannot be used in the browser.' })

    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://project.example.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY:
          'header.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature',
      }),
    ).toMatchObject({ available: false, error: 'A secret Supabase key cannot be used in the browser.' })
  })
})
