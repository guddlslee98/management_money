import { describe, expect, it } from 'vitest'
import type { RecurringRule } from '../db/types'
import { buildRecurringTransaction, dueOccurrences, nextOccurrence } from './recurring'

const rule = (p: Partial<RecurringRule> = {}): RecurringRule => ({
  id: 'r1',
  type: 'expense',
  amount: 500_000,
  categoryId: 'housing.rent',
  accountId: 'acc1',
  toAccountId: null,
  payee: '월세',
  memo: '',
  dayOfMonth: 25,
  startMonth: '2026-06',
  endMonth: null,
  isActive: true,
  createdAt: 0,
  updatedAt: 0,
  ...p,
})

describe('dueOccurrences', () => {
  it('generates past months and skips future dates in the current month', () => {
    const occ = dueOccurrences(rule(), '2026-09-05', [])
    expect(occ).toEqual([
      { month: '2026-06', date: '2026-06-25' },
      { month: '2026-07', date: '2026-07-25' },
      { month: '2026-08', date: '2026-08-25' },
    ])
    const occ2 = dueOccurrences(rule(), '2026-09-25', [])
    expect(occ2.at(-1)).toEqual({ month: '2026-09', date: '2026-09-25' })
  })

  it('skips already generated months and respects endMonth / inactive', () => {
    expect(dueOccurrences(rule(), '2026-09-30', ['2026-06', '2026-08']).map((o) => o.month)).toEqual(['2026-07', '2026-09'])
    expect(dueOccurrences(rule({ endMonth: '2026-07' }), '2026-09-30', []).map((o) => o.month)).toEqual(['2026-06', '2026-07'])
    expect(dueOccurrences(rule({ isActive: false }), '2026-09-30', [])).toEqual([])
    expect(dueOccurrences(rule({ startMonth: '2027-01' }), '2026-09-30', [])).toEqual([])
  })

  it('clamps day 31 to month end', () => {
    const occ = dueOccurrences(rule({ dayOfMonth: 31, startMonth: '2026-02' }), '2026-04-30', [])
    expect(occ.map((o) => o.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('builds transactions with recurring source and clears fields by type', () => {
    const tx = buildRecurringTransaction(rule(), { month: '2026-06', date: '2026-06-25' }, 123)
    expect(tx).toMatchObject({ type: 'expense', amount: 500_000, month: '2026-06', date: '2026-06-25', source: 'recurring', recurringRuleId: 'r1', toAccountId: null })
    const tr = buildRecurringTransaction(rule({ type: 'transfer', toAccountId: 'acc2' }), { month: '2026-06', date: '2026-06-25' }, 1)
    expect(tr.categoryId).toBeNull()
    expect(tr.toAccountId).toBe('acc2')
  })

  it('computes next occurrence', () => {
    expect(nextOccurrence(rule(), '2026-09-05')).toBe('2026-09-25')
    expect(nextOccurrence(rule(), '2026-09-25')).toBe('2026-10-25')
    expect(nextOccurrence(rule({ endMonth: '2026-09' }), '2026-09-26')).toBeNull()
    expect(nextOccurrence(rule({ startMonth: '2027-02', dayOfMonth: 30 }), '2026-09-05')).toBe('2027-02-28')
  })
})
