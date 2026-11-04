import { describe, expect, it } from 'vitest'

import { parseCoordinate } from './coordinates'

describe('coordinate input', () => {
  it('accepts dot and decimal-comma notation without truncation', () => {
    expect(parseCoordinate('5.559729')).toBe(5.559729)
    expect(parseCoordinate('5,559729')).toBe(5.559729)
    expect(parseCoordinate('95,330911')).toBe(95.330911)
  })

  it.each(['', '5,5.5', '5,5,5', '5 5', 'Infinity', '5abc'])('rejects malformed input %j', (value) => {
    expect(parseCoordinate(value)).toBeNull()
  })
})
