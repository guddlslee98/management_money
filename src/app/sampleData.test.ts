import { describe, expect, it } from 'vitest'
import { createTestDB } from '../db/db'
import { makeRepos } from '../db/repo'
import { summarizeMonth } from '../domain/summary'
import { currentMonthKey } from '../domain/dates'
import { seedSampleData } from './sampleData'

describe('seedSampleData', () => {
  it('creates deterministic sample months with income, expenses and transfers', async () => {
    const r = makeRepos(createTestDB('sample-1'))
    await r.ensureSeeded({ categories: [], rules: [] })
    const a = await seedSampleData({ months: 3, seed: 1, target: r })
    expect(a.transactions).toBeGreaterThan(30)
    const r2 = makeRepos(createTestDB('sample-2'))
    await r2.ensureSeeded({ categories: [], rules: [] })
    const b = await seedSampleData({ months: 3, seed: 1, target: r2 })
    expect(b.transactions).toBe(a.transactions)

    const cats = await r.categories.all()
    expect(cats.length).toBeGreaterThan(10)
    const txs = await r.transactions.all()
    expect(txs.some((t) => t.type === 'transfer')).toBe(true)
    expect(txs.some((t) => t.isRefund)).toBe(true)
    const s = summarizeMonth(currentMonthKey(), txs, cats)
    expect(s.expense).toBeGreaterThan(0)
    expect(s.byCategory.length).toBeGreaterThan(3)
  })
})
