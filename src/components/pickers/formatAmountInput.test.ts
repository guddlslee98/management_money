import { describe, expect, it } from 'vitest'
import { formatAmountInput } from './formatAmountInput'

describe('formatAmountInput', () => {
  it('returns empty for no digits', () => {
    expect(formatAmountInput('')).toEqual({ display: '', value: null })
    expect(formatAmountInput('abc')).toEqual({ display: '', value: null })
    expect(formatAmountInput('₩,원')).toEqual({ display: '', value: null })
  })

  it('adds thousands separators while typing', () => {
    expect(formatAmountInput('1')).toEqual({ display: '1', value: 1 })
    expect(formatAmountInput('1234')).toEqual({ display: '1,234', value: 1234 })
    expect(formatAmountInput('1,2345')).toEqual({ display: '12,345', value: 12345 })
    expect(formatAmountInput('1,234,567')).toEqual({ display: '1,234,567', value: 1234567 })
  })

  it('ignores currency symbols, spaces and signs', () => {
    expect(formatAmountInput('₩12,000')).toEqual({ display: '12,000', value: 12000 })
    expect(formatAmountInput('12 000원')).toEqual({ display: '12,000', value: 12000 })
    expect(formatAmountInput('-5000')).toEqual({ display: '5,000', value: 5000 })
  })

  it('normalizes leading zeros and keeps zero', () => {
    expect(formatAmountInput('0')).toEqual({ display: '0', value: 0 })
    expect(formatAmountInput('007')).toEqual({ display: '7', value: 7 })
  })

  it('caps very long input to a safe integer', () => {
    const r = formatAmountInput('9'.repeat(30))
    expect(r.value).toBe(999_999_999_999_999)
    expect(Number.isSafeInteger(r.value!)).toBe(true)
  })
})
