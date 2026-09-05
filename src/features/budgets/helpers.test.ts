import { describe, expect, it } from 'vitest'
import type { Budget, Category } from '../../db/types'
import { budgetUsage } from '../../domain/budget'
import type { CategoryShare } from '../../domain/summary'
import { amountToInput, barColor, budgetRows, expenseParents, fillFromPrevious, formatAmountInput, parseAmountInput, roundUpTo } from './helpers'

const cats: Category[] = [
  { id: 'shopping', kind: 'expense', name: '쇼핑', emoji: '🛍️', color: '#ec4899', parentId: null, sortOrder: 2, isArchived: false },
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'old', kind: 'expense', name: '옛날', emoji: '📦', color: '#999', parentId: null, sortOrder: 1, isArchived: true },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]
const share = (categoryId: string, amount: number): CategoryShare => ({ categoryId, amount, pct: 0, prevAmount: 0, delta: 0, deltaPct: null, txCount: 1, children: [] })

describe('roundUpTo', () => {
  it('rounds up to the step and clamps non-positive to 0', () => {
    expect(roundUpTo(123_456)).toBe(130_000)
    expect(roundUpTo(120_000)).toBe(120_000)
    expect(roundUpTo(1, 10_000)).toBe(10_000)
    expect(roundUpTo(0)).toBe(0)
    expect(roundUpTo(-5000)).toBe(0)
    expect(roundUpTo(1234, 100)).toBe(1300)
    expect(roundUpTo(1234, 0)).toBe(1234)
  })
})

describe('amount input formatting', () => {
  it('parses digits ignoring separators and junk', () => {
    expect(parseAmountInput('300,000')).toBe(300_000)
    expect(parseAmountInput(' 1.234.567원 ')).toBe(1_234_567)
    expect(parseAmountInput('')).toBeNull()
    expect(parseAmountInput('abc')).toBeNull()
    expect(parseAmountInput('-5,000')).toBe(5000)
    expect(parseAmountInput('-5,000', true)).toBe(-5000)
  })
  it('formats while typing', () => {
    expect(formatAmountInput('3000a00')).toBe('300,000')
    expect(formatAmountInput('')).toBe('')
    expect(formatAmountInput('-', true)).toBe('-')
    expect(formatAmountInput('-12000', true)).toBe('-12,000')
    expect(formatAmountInput('-', false)).toBe('')
  })
  it('converts stored amounts to input strings', () => {
    expect(amountToInput(250_000)).toBe('250,000')
    expect(amountToInput(0)).toBe('')
    expect(amountToInput(null)).toBe('')
    expect(amountToInput(-3000)).toBe('-3,000')
  })
})

describe('expenseParents', () => {
  it('keeps only non-archived expense parents sorted by sortOrder', () => {
    expect(expenseParents(cats).map((c) => c.id)).toEqual(['food', 'shopping'])
  })
})

describe('budgetRows', () => {
  const budgets: Budget[] = [
    { id: 'b1', categoryId: 'food', month: '*', amount: 400_000 },
    { id: 'b2', categoryId: 'food', month: '2026-09', amount: 300_000 },
  ]
  it('joins spent, default/month budgets and usage per expense parent', () => {
    const shares = [share('food', 330_000), share('shopping', 50_000)]
    const usages = budgetUsage(budgets, '2026-09', shares)
    const rows = budgetRows(cats, budgets, '2026-09', usages, shares)
    expect(rows.map((r) => r.category.id)).toEqual(['food', 'shopping'])
    expect(rows[0]).toMatchObject({ spent: 330_000, defaultAmount: 400_000, monthAmount: 300_000, hasOverride: true })
    expect(rows[0].usage).toMatchObject({ budget: 300_000, status: 'over' })
    expect(rows[1]).toMatchObject({ spent: 50_000, defaultAmount: 0, monthAmount: 0, hasOverride: false, usage: null })
  })
  it('falls back to the default budget in other months', () => {
    const shares = [share('food', 100_000)]
    const usages = budgetUsage(budgets, '2026-10', shares)
    const rows = budgetRows(cats, budgets, '2026-10', usages, shares)
    expect(rows[0]).toMatchObject({ monthAmount: 0, hasOverride: false })
    expect(rows[0].usage?.budget).toBe(400_000)
  })
})

describe('fillFromPrevious', () => {
  it('proposes rounded-up previous spending only for categories without a default budget', () => {
    const budgets: Budget[] = [{ id: 'b1', categoryId: 'food', month: '*', amount: 400_000 }]
    const prev = [share('food', 350_000), share('shopping', 123_456), share('old', 10_000), share('salary', 1)]
    expect(fillFromPrevious(cats, budgets, prev)).toEqual([{ categoryId: 'shopping', amount: 130_000 }])
    expect(fillFromPrevious(cats, [], [share('shopping', -100)])).toEqual([])
    expect(fillFromPrevious(cats, [], [share('food', 1), share('shopping', 20_000)])).toEqual([
      { categoryId: 'food', amount: 10_000 },
      { categoryId: 'shopping', amount: 20_000 },
    ])
  })
})

describe('barColor', () => {
  it('maps status to token colors', () => {
    expect(barColor('ok', '#f97316')).toBe('#f97316')
    expect(barColor(null, '')).toBe('var(--accent)')
    expect(barColor('warn', '#f97316')).toBe('var(--warn)')
    expect(barColor('over', '#f97316')).toBe('var(--expense)')
  })
})
