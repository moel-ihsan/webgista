import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseAuthGateway } from './supabaseGateway'
import type { AuthSession } from './types'

describe('Supabase auth gateway', () => {
  afterEach(() => vi.useRealTimers())

  it('defers auth events until after Supabase releases its auth callback lock', () => {
    vi.useFakeTimers()
    let emit: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
    const unsubscribe = vi.fn()
    const client = {
      auth: {
        onAuthStateChange: vi.fn((callback: typeof emit) => {
          emit = callback
          return { data: { subscription: { unsubscribe } } }
        }),
      },
    } as unknown as SupabaseClient
    const callback = vi.fn<(session: AuthSession | null) => void>()
    const stop = createSupabaseAuthGateway(client).onAuthStateChange(callback)
    const session = { user: { id: 'user-1', email: 'user@example.test' } } as Session

    emit?.('SIGNED_IN', session)
    expect(callback).not.toHaveBeenCalled()

    vi.runAllTimers()
    expect(callback).toHaveBeenCalledWith({ user: { id: 'user-1', email: 'user@example.test' } })

    stop()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
