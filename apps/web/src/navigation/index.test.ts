import { describe, expect, it } from 'vitest'

import { navigationForRole } from '.'

describe('role-aware navigation', () => {
  it('preserves the v1 destinations for administrators', () => {
    expect(navigationForRole('administrator').map((item) => item.to)).toEqual([
      '/',
      '/map',
      '/cctv',
      '/settings',
    ])
  })

  it('omits administrator settings for agency editors', () => {
    expect(navigationForRole('agency_editor').map((item) => item.to)).toEqual([
      '/',
      '/map',
      '/cctv',
    ])
  })

  it('shows only public destinations without a trusted role', () => {
    expect(navigationForRole(null).map((item) => item.to)).toEqual(['/', '/map'])
  })
})
