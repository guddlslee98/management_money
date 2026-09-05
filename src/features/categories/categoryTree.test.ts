import { describe, expect, it } from 'vitest'
import type { Category } from '../../db/types'
import { archivedEntries, buildCategoryTree, movedSiblingOrder, nextSortOrder } from './categoryTree'

const c = (id: string, parentId: string | null, sortOrder: number, extra: Partial<Category> = {}): Category => ({
  id,
  kind: 'expense',
  name: id,
  emoji: '🏷️',
  color: '#000',
  parentId,
  sortOrder,
  isArchived: false,
  ...extra,
})

const cats: Category[] = [
  c('a', null, 0),
  c('b', null, 1, { isArchived: true }),
  c('c', null, 2),
  c('a1', 'a', 0),
  c('a2', 'a', 1, { isArchived: true }),
  c('a3', 'a', 2),
  c('inc', null, 0, { kind: 'income' }),
]

describe('buildCategoryTree', () => {
  it('splits parents and children by kind, keeping order', () => {
    const t = buildCategoryTree(cats, 'expense')
    expect(t.parents.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(t.childrenOf.get('a')?.map((x) => x.id)).toEqual(['a1', 'a2', 'a3'])
    expect(buildCategoryTree(cats, 'income').parents.map((p) => p.id)).toEqual(['inc'])
  })
})

describe('movedSiblingOrder', () => {
  const t = buildCategoryTree(cats, 'expense')
  it('swaps among visible siblings and appends archived ones', () => {
    expect(movedSiblingOrder(t.parents, 'c', -1)).toEqual(['c', 'a', 'b'])
    expect(movedSiblingOrder(t.childrenOf.get('a')!, 'a1', 1)).toEqual(['a3', 'a1', 'a2'])
  })
  it('returns null at the edges or for unknown ids', () => {
    expect(movedSiblingOrder(t.parents, 'a', -1)).toBeNull()
    expect(movedSiblingOrder(t.parents, 'c', 1)).toBeNull()
    expect(movedSiblingOrder(t.parents, 'zzz', 1)).toBeNull()
    expect(movedSiblingOrder(t.parents, 'b', 1)).toBeNull()
  })
})

describe('nextSortOrder', () => {
  it('appends after the largest sibling sortOrder', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder(buildCategoryTree(cats, 'expense').parents)).toBe(3)
    expect(nextSortOrder([c('x', null, 7)])).toBe(8)
  })
})

describe('archivedEntries', () => {
  it('lists archived parents and archived children of active parents', () => {
    const list = archivedEntries(buildCategoryTree(cats, 'expense'))
    expect(list.map((e) => [e.category.id, e.parentName])).toEqual([
      ['b', null],
      ['a2', 'a'],
    ])
  })
})
