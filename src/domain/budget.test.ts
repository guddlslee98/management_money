import { describe, expect, it } from 'vitest'
import type { Budget } from '../db/types'
import type { CategoryShare } from './summary'
import { budgetFor, budgetUsage, totalBudget } from './budget'

const budgets: Budget[] = [
  { id: 'b1', categoryId: 'food', month: '*', amount: 400_000 },
  { id: 'b2', categoryId: 'food', month: '2026-09', amount: 300_000 },
  { id: 'b3', categoryId: 'housing', month: '*', amount: 700_000 },
  { id: 'b4', categoryId: 'fun', month: '*', amount: 0 },
]
const share = (categoryId: string, amount: number): CategoryShare => ({
  categoryId, amount, pct: 0, prevAmount: 0, delta: 0, deltaPct: null, txCount: 1, children: [],
})

describe('budget', () => {
  it('prefers month-specific budget over default', () => {
    expect(budgetFor(budgets, 'food', '2026-09')?.amount).toBe(300_000)
    expect(budgetFor(budgets, 'food', '2026-10')?.amount).toBe(400_000)
    expect(budgetFor(budgets, 'ghost', '2026-10')).toBeNull()
  })

  it('computes usage, status and ordering', () => {
    const u = budgetUsage(budgets, '2026-09', [share('food', 330_000), share('housing', 500_000), share('other', 10)])
    expect(u.map((x) => x.categoryId)).toEqual(['food', 'housing'])
    expect(u[0]).toMatchObject({ budget: 300_000, spent: 330_000, remaining: -30_000, status: 'over' })
    expect(u[0].ratio).toBeCloseTo(1.1)
    expect(u[1].status).toBe('ok')
    expect(budgetUsage(budgets, '2026-10', [share('food', 330_000)])[0].status).toBe('warn')
    expect(totalBudget(u)).toEqual({ budget: 1_000_000, spent: 830_000, ratio: 0.83 })
  })

  it('treats negative (refund-heavy) spend as zero and skips zero budgets', () => {
    const u = budgetUsage(budgets, '2026-10', [share('food', -5000), share('fun', 100)])
    expect(u).toHaveLength(2)
    expect(u.find((x) => x.categoryId === 'food')?.spent).toBe(0)
    expect(u.find((x) => x.categoryId === 'fun')).toBeUndefined()
  })
})
