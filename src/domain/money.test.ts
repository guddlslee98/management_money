import { describe, expect, it } from 'vitest'
import { formatKRW, formatPct, formatSigned, parseAmount } from './money'

describe('money', () => {
  it('formats KRW without decimals', () => {
    expect(formatKRW(1234567)).toBe('₩1,234,567')
    expect(formatKRW(0)).toBe('₩0')
    expect(formatKRW(-500)).toBe('-₩500')
  })

  it('formats signed amounts', () => {
    expect(formatSigned(1000)).toBe('+₩1,000')
    expect(formatSigned(-1000)).toBe('-₩1,000')
    expect(formatSigned(0)).toBe('₩0')
  })

  it('parses Korean amount strings', () => {
    expect(parseAmount('1,234,567원')).toBe(1234567)
    expect(parseAmount('₩12,000')).toBe(12000)
    expect(parseAmount('-3,500')).toBe(-3500)
    expect(parseAmount('(2,000)')).toBe(-2000)
    expect(parseAmount('1.234.567')).toBe(1234567)
    expect(parseAmount('12.5')).toBe(13)
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount(4200)).toBe(4200)
  })

  it('formats percentages', () => {
    expect(formatPct(0.1234)).toBe('12.3%')
    expect(formatPct(NaN)).toBe('0%')
  })
})
