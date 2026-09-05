import { useMemo, useState } from 'react'
import { Button, CategoryBadge, Sheet } from '../../components/ui'
import { UNCATEGORIZED, type Category, type CategoryKind } from '../../db/types'
import { cn } from '../../lib/cn'

export interface CategoryPickerProps {
  open: boolean
  kind: CategoryKind
  categories: Category[]
  value: string | null
  /** "항상 이 카테고리로" 체크박스에 보여줄 거래처 */
  payee: string
  onClose: () => void
  onPick: (categoryId: string | null, always: boolean) => void
}

function PickRow({
  c,
  sub,
  selected,
  onPick,
}: {
  c: Pick<Category, 'id' | 'name' | 'emoji' | 'color'>
  sub?: boolean
  selected: boolean
  onPick: (id: string | null) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(c.id === UNCATEGORIZED.id ? null : c.id)}
      className={cn('w-full flex items-center justify-between px-3 h-11 rounded-xl hover:bg-surface-2 text-left', sub && 'pl-9', selected && 'bg-accent-soft')}
      aria-label={`${c.name} 선택`}
    >
      <CategoryBadge category={c} size="sm" />
      {selected && <span className="text-accent text-sm">✓</span>}
    </button>
  )
}

/** 대분류 아래 소분류를 들여쓴 목록에서 카테고리를 고르는 바텀시트 */
export function CategoryPicker({ open, kind, categories, value, payee, onClose, onPick }: CategoryPickerProps) {
  const [always, setAlways] = useState(false)
  const groups = useMemo(() => {
    const pool = categories.filter((c) => c.kind === kind && !c.isArchived)
    const tops = pool.filter((c) => c.parentId === null)
    return tops.map((t) => ({ top: t, subs: pool.filter((c) => c.parentId === t.id) }))
  }, [categories, kind])

  const pick = (id: string | null) => {
    onPick(id, always && Boolean(payee))
    setAlways(false)
  }

  return (
    <Sheet open={open} onClose={onClose} title="카테고리 선택">
      {payee && (
        <label className="flex items-center gap-2 mb-3 text-sm">
          <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          <span>
            <span className="font-medium">{payee}</span>
            <span className="text-muted">은(는) 항상 이 카테고리로</span>
          </span>
        </label>
      )}
      <div className="space-y-0.5">
        <PickRow c={UNCATEGORIZED} selected={value === null} onPick={pick} />
        {groups.map(({ top, subs }) => (
          <div key={top.id}>
            <PickRow c={top} selected={value === top.id} onPick={pick} />
            {subs.map((s) => (
              <PickRow key={s.id} c={s} sub selected={value === s.id} onPick={pick} />
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted px-3 py-4">카테고리가 없습니다. 더보기 › 카테고리 관리에서 먼저 추가하세요.</p>}
      </div>
      <div className="mt-3">
        <Button variant="secondary" full onClick={onClose}>
          닫기
        </Button>
      </div>
    </Sheet>
  )
}
