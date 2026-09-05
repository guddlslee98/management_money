import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDB } from './db'
import { makeRepos, ValidationError, type Repos } from './repo'
import type { Category } from './types'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]

let n = 0
let r: Repos

beforeEach(async () => {
  r = makeRepos(createTestDB(`test-${++n}`))
  await r.ensureSeeded({ categories: cats, rules: [{ pattern: '스타벅스', categoryId: 'food.cafe', priority: 100 }] })
})

describe('seeding', () => {
  it('seeds once', async () => {
    expect((await r.categories.all()).length).toBe(3)
    expect((await r.accounts.all()).map((a) => a.name)).toEqual(['현금', '은행 계좌', '신용카드'])
    expect((await r.classifyRules.all()).length).toBe(1)
    expect(await r.ensureSeeded({ categories: cats, rules: [] })).toBe(false)
  })
})

describe('transactions', () => {
  it('adds, derives month, queries by month sorted desc', async () => {
    await r.transactions.add({ type: 'expense', date: '2026-09-03', amount: 4500, categoryId: 'food.cafe', accountId: 'acc.card', toAccountId: null, payee: '스타벅스', memo: '', isRefund: false })
    await r.transactions.add({ type: 'expense', date: '2026-09-10', amount: 12000, categoryId: 'food', accountId: 'acc.cash', toAccountId: null, payee: '김밥천국', memo: '', isRefund: false })
    await r.transactions.add({ type: 'income', date: '2026-08-25', amount: 3_000_000, categoryId: 'salary', accountId: 'acc.bank', toAccountId: null, payee: '회사', memo: '', isRefund: false })
    const sep = await r.transactions.byMonth('2026-09')
    expect(sep.map((t) => t.payee)).toEqual(['김밥천국', '스타벅스'])
    expect(sep[0].month).toBe('2026-09')
    expect((await r.transactions.byMonths(['2026-08', '2026-09'])).length).toBe(3)
    expect((await r.transactions.betweenDates('2026-09-01', '2026-09-05')).length).toBe(1)
    expect((await r.transactions.search('김밥')).length).toBe(1)
    expect(await r.transactions.recentPayees()).toEqual(['김밥천국', '스타벅스', '회사'])
  })

  it('validates input', async () => {
    const base = { type: 'expense' as const, date: '2026-09-03', amount: 100, categoryId: null, accountId: null, toAccountId: null, payee: '', memo: '', isRefund: false }
    await expect(r.transactions.add({ ...base, date: '2026-13-01' })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.transactions.add({ ...base, amount: -1 })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.transactions.add({ ...base, amount: 1.5 })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.transactions.add({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'a' })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.transactions.add({ ...base, type: 'transfer', accountId: 'a', toAccountId: null })).rejects.toBeInstanceOf(ValidationError)
  })

  it('updates and normalizes type-specific fields', async () => {
    const tx = await r.transactions.add({ type: 'expense', date: '2026-09-03', amount: 4500, categoryId: 'food.cafe', accountId: 'acc.card', toAccountId: null, payee: '스타벅스', memo: '', isRefund: true })
    const upd = await r.transactions.update(tx.id, { type: 'transfer', accountId: 'acc.bank', toAccountId: 'acc.card', date: '2026-10-01' })
    expect(upd.categoryId).toBeNull()
    expect(upd.isRefund).toBe(false)
    expect(upd.month).toBe('2026-10')
    await r.transactions.remove(tx.id)
    expect(await r.transactions.count()).toBe(0)
  })

  it('finds existing import hashes', async () => {
    await r.transactions.bulkAdd([
      { type: 'expense', date: '2026-09-03', amount: 1, categoryId: null, accountId: null, toAccountId: null, payee: 'a', memo: '', isRefund: false, importHash: 'h1', source: 'import' },
      { type: 'expense', date: '2026-09-03', amount: 2, categoryId: null, accountId: null, toAccountId: null, payee: 'b', memo: '', isRefund: false, importHash: 'h2', source: 'import' },
    ])
    expect(await r.transactions.existingHashes(['h1', 'h3'])).toEqual(new Set(['h1']))
    expect(await r.transactions.existingHashes([])).toEqual(new Set())
  })
})

describe('categories', () => {
  it('adds sub-categories with validation and removes cascading', async () => {
    const sub = await r.categories.add({ kind: 'expense', name: '배달', emoji: '🛵', color: '#f97316', parentId: 'food' })
    expect(sub.parentId).toBe('food')
    await expect(r.categories.add({ kind: 'expense', name: 'x', emoji: '', color: '', parentId: sub.id })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.categories.add({ kind: 'income', name: 'x', emoji: '', color: '', parentId: 'food' })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.categories.add({ kind: 'income', name: '  ', emoji: '', color: '', parentId: null })).rejects.toBeInstanceOf(ValidationError)

    const tx = await r.transactions.add({ type: 'expense', date: '2026-09-03', amount: 4500, categoryId: sub.id, accountId: null, toAccountId: null, payee: '', memo: '', isRefund: false })
    await r.budgets.set('food', '*', 100_000)
    await r.categories.remove('food')
    expect((await r.categories.all()).map((c) => c.id)).toEqual(['salary'])
    expect((await r.transactions.get(tx.id))?.categoryId).toBeNull()
    expect(await r.budgets.all()).toEqual([])
    expect(await r.classifyRules.all()).toEqual([])
  })

  it('assigns increasing sortOrder to new top-level categories', async () => {
    const a = await r.categories.add({ kind: 'expense', name: 'A', emoji: '', color: '', parentId: null })
    const b = await r.categories.add({ kind: 'expense', name: 'B', emoji: '', color: '', parentId: null })
    expect(b.sortOrder).toBe(a.sortOrder + 1)
    const s1 = await r.categories.add({ kind: 'expense', name: 'S1', emoji: '', color: '', parentId: a.id })
    const s2 = await r.categories.add({ kind: 'expense', name: 'S2', emoji: '', color: '', parentId: a.id })
    expect(s1.sortOrder).toBe(0)
    expect(s2.sortOrder).toBe(1)
  })
})

describe('accounts', () => {
  it('removes account and detaches references', async () => {
    const tx = await r.transactions.add({ type: 'transfer', date: '2026-09-03', amount: 100, categoryId: null, accountId: 'acc.bank', toAccountId: 'acc.card', payee: '', memo: '', isRefund: false })
    await r.accounts.remove('acc.card')
    expect((await r.transactions.get(tx.id))?.toAccountId).toBeNull()
    expect((await r.accounts.all()).length).toBe(2)
  })
})

describe('budgets', () => {
  it('upserts and deletes on zero', async () => {
    await r.budgets.set('food', '*', 300_000)
    await r.budgets.set('food', '*', 350_000)
    await r.budgets.set('food', '2026-09', 200_000)
    expect((await r.budgets.all()).map((b) => [b.month, b.amount]).sort()).toEqual([['*', 350_000], ['2026-09', 200_000]])
    await r.budgets.set('food', '2026-09', 0)
    expect((await r.budgets.all()).length).toBe(1)
    await expect(r.budgets.set('food', '*', 1.5)).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('recurring', () => {
  it('generates due transactions idempotently', async () => {
    const rule = await r.recurring.add({ type: 'expense', amount: 500_000, categoryId: 'food', accountId: 'acc.bank', toAccountId: null, payee: '월세', memo: '', dayOfMonth: 25, startMonth: '2026-07', endMonth: null, isActive: true })
    expect(await r.recurring.generateDue('2026-09-05')).toBe(2)
    expect(await r.recurring.generateDue('2026-09-05')).toBe(0)
    expect(await r.recurring.generateDue('2026-09-25')).toBe(1)
    const generated = await r.transactions.byRecurringRule(rule.id)
    expect(generated.map((t) => t.date).sort()).toEqual(['2026-07-25', '2026-08-25', '2026-09-25'])
    // 사용자가 생성된 거래 하나를 지워도 다시 만들지 않는다? — 삭제된 달은 다시 생성된다(멱등 기준은 '존재하는 달')
    await r.transactions.remove(generated[0].id)
    expect(await r.recurring.generateDue('2026-09-25')).toBe(1)

    await r.recurring.update(rule.id, { isActive: false })
    expect(await r.recurring.generateDue('2026-12-31')).toBe(0)
    await r.recurring.remove(rule.id, true)
    expect(await r.transactions.count()).toBe(0)
  })

  it('validates rules', async () => {
    const base = { type: 'expense' as const, amount: 1, categoryId: null, accountId: null, toAccountId: null, payee: '', memo: '', dayOfMonth: 1, startMonth: '2026-01', endMonth: null, isActive: true }
    await expect(r.recurring.add({ ...base, dayOfMonth: 32 })).rejects.toBeInstanceOf(ValidationError)
    await expect(r.recurring.add({ ...base, type: 'transfer', accountId: 'a', toAccountId: 'a' })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('classify rules & settings & backup', () => {
  it('adds user rules without duplicates and resets defaults', async () => {
    await r.classifyRules.addUserRule('이디야', 'food.cafe')
    await r.classifyRules.addUserRule('이디야', 'food')
    const user = (await r.classifyRules.all()).filter((x) => x.source === 'user')
    expect(user).toHaveLength(1)
    expect(user[0].categoryId).toBe('food')
    await r.classifyRules.resetDefaults([{ pattern: 'a', categoryId: 'food', priority: 1 }, { pattern: 'b', categoryId: 'food', priority: 1 }])
    expect((await r.classifyRules.all()).length).toBe(3)
  })

  it('round-trips a backup', async () => {
    await r.transactions.add({ type: 'expense', date: '2026-09-03', amount: 4500, categoryId: 'food.cafe', accountId: 'acc.card', toAccountId: null, payee: '스타벅스', memo: '', isRefund: false })
    await r.settings.set('theme', 'dark')
    const dump = await r.dumpAll()
    expect(dump.transactions).toHaveLength(1)
    await r.clearAll()
    expect(await r.transactions.count()).toBe(0)
    await r.restoreAll(dump, 'replace')
    expect(await r.transactions.count()).toBe(1)
    expect(await r.settings.get('theme', 'light')).toBe('dark')
    await r.restoreAll(dump, 'merge')
    expect(await r.transactions.count()).toBe(1)
    await expect(r.restoreAll({ app: 'x' } as never, 'replace')).rejects.toBeInstanceOf(ValidationError)
  })
})
