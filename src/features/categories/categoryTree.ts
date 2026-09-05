import type { Category, CategoryKind } from '../../db/types'

export interface CategoryTree {
  /** 대분류 (입력 순서 = sortOrder 순) */
  parents: Category[]
  /** 대분류 id → 소분류 목록 */
  childrenOf: Map<string, Category[]>
}

/** kind별 2단계 트리. 보관 여부와 무관하게 전부 담는다 */
export function buildCategoryTree(cats: Category[], kind: CategoryKind): CategoryTree {
  const parents: Category[] = []
  const childrenOf = new Map<string, Category[]>()
  for (const c of cats) {
    if (c.kind !== kind) continue
    if (c.parentId === null) {
      parents.push(c)
    } else {
      const list = childrenOf.get(c.parentId) ?? []
      list.push(c)
      childrenOf.set(c.parentId, list)
    }
  }
  return { parents, childrenOf }
}

/**
 * 보이는(보관되지 않은) 형제 사이에서 한 칸 위/아래로 옮긴 뒤의 id 순서.
 * 보관된 형제는 기존 순서대로 뒤에 붙인다. 이동할 수 없으면 null.
 */
export function movedSiblingOrder(siblings: Category[], id: string, dir: -1 | 1): string[] | null {
  const visible = siblings.filter((s) => !s.isArchived)
  const i = visible.findIndex((s) => s.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= visible.length) return null
  const next = [...visible]
  ;[next[i], next[j]] = [next[j], next[i]]
  return [...next.map((s) => s.id), ...siblings.filter((s) => s.isArchived).map((s) => s.id)]
}

/**
 * 형제들 뒤에 붙일 sortOrder (최댓값 + 1).
 * repo.categories.add 는 [kind+parentId] 인덱스로 형제 수를 세는데 IndexedDB 는 null(parentId)을 색인하지 못해
 * 대분류가 항상 0이 되므로, 화면에서 직접 계산해 넘긴다.
 */
export function nextSortOrder(siblings: Category[]): number {
  let max = -1
  for (const s of siblings) if (s.sortOrder > max) max = s.sortOrder
  return max + 1
}

export interface ArchivedEntry {
  category: Category
  /** 소분류면 대분류 이름 */
  parentName: string | null
}

/** 보관된 대분류(먼저) + (보관되지 않은 대분류 아래의) 보관된 소분류 */
export function archivedEntries(tree: CategoryTree): ArchivedEntry[] {
  const out: ArchivedEntry[] = []
  for (const p of tree.parents) if (p.isArchived) out.push({ category: p, parentName: null })
  for (const p of tree.parents) {
    if (p.isArchived) continue
    for (const c of tree.childrenOf.get(p.id) ?? []) if (c.isArchived) out.push({ category: c, parentName: p.name })
  }
  return out
}
