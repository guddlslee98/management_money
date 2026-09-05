import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dateInMonth,
  daysInMonth,
  formatDateKo,
  formatMonthKo,
  isDateKey,
  lastNMonths,
  monthRange,
  normalizeDate,
} from './dates'

describe('dates', () => {
  it('month arithmetic crosses years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-03', -15)).toBe('2024-12')
    expect(lastNMonths('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  it('knows month lengths incl. leap years', () => {
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2025-02')).toBe(28)
    expect(daysInMonth('2026-09')).toBe(30)
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28')
    expect(dateInMonth('2026-02', 0)).toBe('2026-02-01')
  })

  it('validates date keys', () => {
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2024-02-29')).toBe(true)
    expect(isDateKey('2026-13-01')).toBe(false)
  })

  it('normalizes many date formats', () => {
    expect(normalizeDate('2026-09-05')).toBe('2026-09-05')
    expect(normalizeDate('2026.09.05')).toBe('2026-09-05')
    expect(normalizeDate('2026/9/5')).toBe('2026-09-05')
    expect(normalizeDate('20260905')).toBe('2026-09-05')
    expect(normalizeDate('2026-09-05 13:20:11')).toBe('2026-09-05')
    expect(normalizeDate('26.09.05')).toBe('2026-09-05')
    expect(normalizeDate(45905)).toBe('2025-09-05') // 엑셀 시리얼
    expect(normalizeDate(45905.75)).toBe('2025-09-05') // 시각 포함 시리얼도 같은 날
    expect(normalizeDate('')).toBeNull()
    expect(normalizeDate('hello')).toBeNull()
    expect(normalizeDate('2026-02-30')).toBeNull()
  })

  it('formats Korean labels', () => {
    expect(formatMonthKo('2026-09')).toBe('2026년 9월')
    expect(formatDateKo('2026-09-05')).toBe('9월 5일 (토)')
    expect(formatDateKo('2026-09-05', true)).toBe('2026년 9월 5일 (토)')
  })
})
