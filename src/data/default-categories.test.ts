import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES, DEFAULT_RULES } from './default-categories'

const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id))
const parents = DEFAULT_CATEGORIES.filter((c) => c.parentId === null)
const children = DEFAULT_CATEGORIES.filter((c) => c.parentId !== null)

describe('DEFAULT_CATEGORIES', () => {
  it('has unique ids', () => {
    expect(ids.size).toBe(DEFAULT_CATEGORIES.length)
  })

  it('every 소분류 points to an existing 대분류 of the same kind and id is <parent>.<child>', () => {
    for (const c of children) {
      const parent = DEFAULT_CATEGORIES.find((p) => p.id === c.parentId)
      expect(parent, `parent of ${c.id}`).toBeDefined()
      expect(parent!.parentId, `${c.id} parent must be a 대분류`).toBeNull()
      expect(parent!.kind, `${c.id} kind`).toBe(c.kind)
      expect(c.id.startsWith(`${c.parentId}.`), `${c.id} id prefix`).toBe(true)
      expect(c.color, `${c.id} inherits parent color`).toBe(parent!.color)
    }
  })

  it('has 12~14 expense and 6~7 income 대분류, each expense 대분류 with 3~8 소분류', () => {
    const expense = parents.filter((p) => p.kind === 'expense')
    const income = parents.filter((p) => p.kind === 'income')
    expect(expense.length).toBeGreaterThanOrEqual(12)
    expect(expense.length).toBeLessThanOrEqual(14)
    expect(income.length).toBeGreaterThanOrEqual(6)
    expect(income.length).toBeLessThanOrEqual(7)
    for (const p of expense) {
      const n = children.filter((c) => c.parentId === p.id).length
      expect(n, `소분류 count of ${p.id}`).toBeGreaterThanOrEqual(3)
      expect(n, `소분류 count of ${p.id}`).toBeLessThanOrEqual(8)
    }
  })

  it('every 대분류 has a 6-digit hex color, one emoji, and colors are unique within a kind', () => {
    for (const p of parents) {
      expect(p.color, p.id).toMatch(/^#[0-9a-f]{6}$/i)
      expect(p.emoji.length, `${p.id} emoji`).toBeGreaterThan(0)
    }
    for (const kind of ['expense', 'income'] as const) {
      const colors = parents.filter((p) => p.kind === kind).map((p) => p.color.toLowerCase())
      expect(new Set(colors).size, `${kind} colors unique`).toBe(colors.length)
    }
  })

  it('has well-formed fields', () => {
    const seen = new Set<number>()
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.id).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/)
      expect(['expense', 'income']).toContain(c.kind)
      expect(c.name.trim().length).toBeGreaterThan(0)
      expect(c.isArchived).toBe(false)
      expect(Number.isInteger(c.sortOrder)).toBe(true)
      expect(seen.has(c.sortOrder), `duplicate sortOrder ${c.sortOrder}`).toBe(false)
      seen.add(c.sortOrder)
    }
  })
})

describe('DEFAULT_RULES', () => {
  it('has at least 120 rules', () => {
    expect(DEFAULT_RULES.length).toBeGreaterThanOrEqual(120)
  })

  it('every rule points to an existing category', () => {
    for (const r of DEFAULT_RULES) {
      expect(ids.has(r.categoryId), `rule "${r.pattern}" -> ${r.categoryId}`).toBe(true)
    }
  })

  it('patterns are non-empty, space-free keywords with a positive priority', () => {
    const allKeywords = new Set<string>()
    for (const r of DEFAULT_RULES) {
      expect(r.pattern.length).toBeGreaterThan(0)
      expect(r.pattern, `pattern "${r.pattern}" must not contain whitespace`).not.toMatch(/\s/)
      expect(Number.isInteger(r.priority) && r.priority > 0, `priority of "${r.pattern}"`).toBe(true)
      for (const kw of r.pattern.split('|')) {
        expect(kw.length, `empty keyword in "${r.pattern}"`).toBeGreaterThan(0)
        expect(allKeywords.has(kw.toLowerCase()), `duplicate keyword "${kw}"`).toBe(false)
        allKeywords.add(kw.toLowerCase())
      }
    }
  })

  it('no keyword is shadowed by a higher-priority rule of a different category', () => {
    // 분류기는 공백 제거 + 소문자 비교 후 부분 문자열 매칭을 하므로, 어떤 키워드 k가
    // 다른 규칙의 키워드를 포함(substring)하면 그 규칙도 함께 매칭된다.
    // 그런 경우 k를 가진 규칙의 우선순위가 반드시 가장 높아야 의도한 분류가 된다.
    const rules = DEFAULT_RULES.map((r) => ({
      ...r,
      keywords: r.pattern.toLowerCase().split('|'),
    }))
    for (const r of rules) {
      for (const kw of r.keywords) {
        let best = r
        for (const o of rules) {
          if (o === r) continue
          if (o.keywords.some((ok) => kw.includes(ok)) && o.priority >= best.priority) best = o
        }
        expect(
          best.categoryId,
          `keyword "${kw}" (${r.categoryId}, p=${r.priority}) is shadowed by "${best.pattern}" (${best.categoryId}, p=${best.priority})`,
        ).toBe(r.categoryId)
      }
    }
  })
})
