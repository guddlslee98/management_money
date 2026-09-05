import { useMemo, useState, type ReactNode } from 'react'
import type { Category, CategoryKind } from '../../db/types'
import { useCategories } from '../../hooks/data'
import { cn } from '../../lib/cn'
import { Button, CategoryBadge, Sheet } from '../ui'

export interface CategoryPickerProps {
  kind: CategoryKind
  value: string | null
  onChange: (id: string | null) => void
  /** 보관된 카테고리도 고를 수 있게 */
  includeArchived?: boolean
  label?: string
  id?: string
}

/** 대분류 격자 → 소분류 칩 순서로 고르는 바텀시트 선택기 */
export function CategoryPicker({ kind, value, onChange, includeArchived = false, label = '카테고리', id = 'category-picker' }: CategoryPickerProps) {
  const cats = useCategories()
  const [open, setOpen] = useState(false)
  const [parentId, setParentId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats])
  const { parents, childrenOf } = useMemo(() => {
    const visible = (c: Category) => c.kind === kind && (includeArchived || !c.isArchived)
    const parents = cats.filter((c) => c.parentId === null && visible(c))
    const childrenOf = new Map<string, Category[]>()
    for (const c of cats) {
      if (!c.parentId || !visible(c)) continue
      const list = childrenOf.get(c.parentId) ?? []
      list.push(c)
      childrenOf.set(c.parentId, list)
    }
    return { parents, childrenOf }
  }, [cats, kind, includeArchived])

  const selected = value ? (byId.get(value) ?? null) : null
  const selectedParentId = selected ? (selected.parentId ?? selected.id) : null
  const parent = parentId ? (byId.get(parentId) ?? null) : null
  const children = parentId ? (childrenOf.get(parentId) ?? []) : []

  const close = () => {
    setOpen(false)
    setParentId(null)
  }
  const pick = (next: string | null) => {
    onChange(next)
    close()
  }
  const tapParent = (p: Category) => {
    if ((childrenOf.get(p.id) ?? []).length === 0) pick(p.id)
    else setParentId(p.id)
  }

  return (
    <div>
      {/* label[for]를 버튼에 걸면 접근성 이름이 라벨로만 잡히므로, 라벨 + 현재 선택값을 함께 읽도록 aria-labelledby 사용 */}
      <span id={`${id}-label`} className="block text-xs font-medium text-muted mb-1">
        {label}
      </span>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={`${id}-label ${id}`}
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-xl border border-border bg-surface px-3 flex items-center justify-between gap-2 text-left text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
      >
        {selected ? <CategoryBadge category={selected} size="sm" /> : <span className="text-muted">카테고리 선택</span>}
        <span className="text-muted" aria-hidden>
          ›
        </span>
      </button>

      <Sheet open={open} onClose={close} title={parent ? '소분류 선택' : '카테고리 선택'}>
        {parent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setParentId(null)} aria-label="대분류 목록으로">
                ‹ 대분류
              </Button>
              <CategoryBadge category={parent} size="sm" className="font-medium" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip active={value === parent.id} color={parent.color} onClick={() => pick(parent.id)}>
                대분류 자체 선택
              </Chip>
              {children.map((c) => (
                <Chip key={c.id} active={value === c.id} color={c.color} onClick={() => pick(c.id)}>
                  <span aria-hidden>{c.emoji}</span> {c.name}
                  {c.isArchived && <span className="ml-1 text-[10px] opacity-70">보관됨</span>}
                </Chip>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {parents.length === 0 ? (
              <p className="text-sm text-muted text-center py-6">카테고리가 없어요. 더보기 › 카테고리 관리에서 추가하세요.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {parents.map((p) => {
                  const active = selectedParentId === p.id
                  const hasChildren = (childrenOf.get(p.id) ?? []).length > 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => tapParent(p)}
                      aria-pressed={active}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl border p-3 text-sm transition hover:bg-surface-2',
                        active ? 'border-accent bg-accent-soft/40' : 'border-border',
                      )}
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xl" style={{ background: `${p.color}26`, color: p.color }} aria-hidden>
                        {p.emoji}
                      </span>
                      <span className="truncate max-w-full">
                        {p.name}
                        {hasChildren && (
                          <span className="text-muted" aria-hidden>
                            {' '}
                            ›
                          </span>
                        )}
                      </span>
                      {p.isArchived && <span className="text-[10px] text-muted">보관됨</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <Button variant="secondary" full onClick={() => pick(null)}>
              ❔ 미분류
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('h-9 rounded-full border px-3 text-sm transition', active ? 'text-white' : 'bg-surface hover:bg-surface-2')}
      style={active ? { background: color, borderColor: color } : { borderColor: `${color}80` }}
    >
      {children}
    </button>
  )
}
