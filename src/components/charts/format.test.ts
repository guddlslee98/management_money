import { describe, expect, it } from 'vitest'
import { formatAxisKRW } from './format'

describe('formatAxisKRW', () => {
  it('abbreviates to 만/억 units', () => {
    expect(formatAxisKRW(1_200_000)).toBe('120만')
    expect(formatAxisKRW(15_000)).toBe('1.5만')
    expect(formatAxisKRW(800)).toBe('800')
    expect(formatAxisKRW(10_000)).toBe('1만')
    expect(formatAxisKRW(123_456)).toBe('12.3만')
    expect(formatAxisKRW(100_000_000)).toBe('1억')
    expect(formatAxisKRW(150_000_000)).toBe('1.5억')
    expect(formatAxisKRW(99_999_999)).toBe('1억')
  })

  it('handles zero, negatives, thousands separators and non-finite input', () => {
    expect(formatAxisKRW(0)).toBe('0')
    expect(formatAxisKRW(-15_000)).toBe('-1.5만')
    expect(formatAxisKRW(-800)).toBe('-800')
    expect(formatAxisKRW(9_500)).toBe('9,500')
    expect(formatAxisKRW(Number.NaN)).toBe('')
  })
})
