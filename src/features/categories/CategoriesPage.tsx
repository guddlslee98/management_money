import { useMemo, useState } from 'react'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, CategoryBadge, EmptyState, Field, Input, PageHeader, Segmented, Sheet } from '../../components/ui'
import type { SegmentOption } from '../../components/ui/Segmented'
import { categoryRepo, ValidationError } from '../../db/repo'
import type { Category, CategoryKind } from '../../db/types'
import { useCategories } from '../../hooks/data'
import { cn } from '../../lib/cn'
import { archivedEntries, buildCategoryTree, movedSiblingOrder, nextSortOrder } from './categoryTree'
import { CATEGORY_PALETTE } from './palette'

const KIND_OPTIONS: SegmentOption<CategoryKind>[] = [
  { value: 'expense', label: '지출', activeClass: 'text-expense' },
  { value: 'income', label: '수입', activeClass: 'text-income' },
]

type SheetState = { mode: 'add'; parent: Category | null } | { mode: 'edit'; category: Category; parent: Category | null }

function errorMessage(e: unknown): string {
  return e instanceof ValidationError ? e.message : '작업에 실패했어요. 다시 시도해 주세요.'
}

export default function CategoriesPage() {
  const cats = useCategories()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tree = useMemo(() => buildCategoryTree(cats, kind), [cats, kind])
  const active = tree.parents.filter((p) => !p.isArchived)
  const archived = useMemo(() => archivedEntries(tree), [tree])

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  const move = (c: Category, dir: -1 | 1) => {
    const siblings = c.parentId ? (tree.childrenOf.get(c.parentId) ?? []) : tree.parents
    const order = movedSiblingOrder(siblings, c.id, dir)
    if (order) void run(() => categoryRepo.reorder(order))
  }
  const restore = (c: Category) => void run(() => categoryRepo.update(c.id, { isArchived: false }))
  const parentOf = (c: Category) => (c.parentId ? (tree.parents.find((p) => p.id === c.parentId) ?? null) : null)

  return (
    <>
      <PageHeader
        title="카테고리 관리"
        back="/more"
        right={
          <Button size="sm" onClick={() => setSheet({ mode: 'add', parent: null })}>
            + 대분류
          </Button>
        }
      />
      <Page>
        <Segmented value={kind} onChange={setKind} options={KIND_OPTIONS} />
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}

        {active.length === 0 ? (
          <EmptyState
            emoji="🏷️"
            title={`${kind === 'expense' ? '지출' : '수입'} 카테고리가 없어요`}
            description="대분류를 먼저 만들고, 그 아래에 소분류를 추가할 수 있어요"
            action={<Button onClick={() => setSheet({ mode: 'add', parent: null })}>대분류 추가</Button>}
          />
        ) : (
          <Card className="p-0 divide-y divide-border overflow-hidden">
            {active.map((p, i) => {
              const kids = (tree.childrenOf.get(p.id) ?? []).filter((k) => !k.isArchived)
              const open = expanded[p.id] ?? false
              return (
                <div key={p.id}>
                  <div className="flex items-center gap-1 pl-3 pr-2 py-2">
                    <button
                      type="button"
                      onClick={() => setExpanded((s) => ({ ...s, [p.id]: !open }))}
                      aria-expanded={open}
                      aria-label={`${p.name} 소분류 ${open ? '접기' : '펼치기'}`}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left h-9"
                    >
                      <CategoryBadge category={p} className="min-w-0 font-medium" />
                      <span className="text-xs text-muted shrink-0">{kids.length > 0 ? `소분류 ${kids.length}` : ''}</span>
                      <span className="text-muted ml-auto pl-1" aria-hidden>
                        {open ? '▾' : '▸'}
                      </span>
                    </button>
                    <RowActions
                      name={p.name}
                      canUp={i > 0}
                      canDown={i < active.length - 1}
                      onUp={() => move(p, -1)}
                      onDown={() => move(p, 1)}
                      onEdit={() => setSheet({ mode: 'edit', category: p, parent: null })}
                    />
                  </div>
                  {open && (
                    <div className="border-t border-border bg-surface-2/40">
                      {kids.map((k, j) => (
                        <div key={k.id} className="flex items-center gap-1 pl-8 pr-2 py-1.5">
                          <CategoryBadge category={k} size="sm" className="flex-1 min-w-0 text-sm" />
                          <RowActions
                            name={k.name}
                            canUp={j > 0}
                            canDown={j < kids.length - 1}
                            onUp={() => move(k, -1)}
                            onDown={() => move(k, 1)}
                            onEdit={() => setSheet({ mode: 'edit', category: k, parent: p })}
                          />
                        </div>
                      ))}
                      <div className="pl-7 pr-2 py-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setSheet({ mode: 'add', parent: p })}>
                          + 소분류 추가
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </Card>
        )}

        {archived.length > 0 && (
          <section>
            <CardTitle>보관됨</CardTitle>
            <Card className="p-0 divide-y divide-border overflow-hidden">
              {archived.map(({ category: c, parentName }) => (
                <div key={c.id} className="flex items-center gap-2 pl-3 pr-2 py-2">
                  <CategoryBadge category={c} size="sm" className="flex-1 min-w-0 text-sm opacity-70" />
                  {parentName && <span className="text-xs text-muted truncate">{parentName} 소분류</span>}
                  <Button size="sm" variant="secondary" onClick={() => restore(c)} aria-label={`${c.name} 복원`}>
                    복원
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSheet({ mode: 'edit', category: c, parent: parentOf(c) })} aria-label={`${c.name} 수정`}>
                    ✎
                  </Button>
                </div>
              ))}
            </Card>
          </section>
        )}
      </Page>

      {sheet && (
        <CategoryFormSheet
          key={sheet.mode === 'edit' ? sheet.category.id : `add-${sheet.parent?.id ?? 'root'}`}
          state={sheet}
          kind={kind}
          sortOrder={nextSortOrder(sheet.parent ? (tree.childrenOf.get(sheet.parent.id) ?? []) : tree.parents)}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

function RowActions({ name, canUp, canDown, onUp, onDown, onEdit }: { name: string; canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void; onEdit: () => void }) {
  const btn = 'h-8 w-8 rounded-lg text-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <span className="flex items-center shrink-0">
      <button type="button" className={btn} onClick={onUp} disabled={!canUp} aria-label={`${name} 위로`}>
        ▲
      </button>
      <button type="button" className={btn} onClick={onDown} disabled={!canDown} aria-label={`${name} 아래로`}>
        ▼
      </button>
      <button type="button" className={btn} onClick={onEdit} aria-label={`${name} 수정`}>
        ✎
      </button>
    </span>
  )
}

function CategoryFormSheet({ state, kind, sortOrder, onClose }: { state: SheetState; kind: CategoryKind; sortOrder: number; onClose: () => void }) {
  const editing = state.mode === 'edit' ? state.category : null
  const parent = state.parent
  const [name, setName] = useState(editing?.name ?? '')
  const [emoji, setEmoji] = useState(editing?.emoji ?? parent?.emoji ?? '🏷️')
  const [color, setColor] = useState(editing?.color ?? parent?.color ?? CATEGORY_PALETTE[0])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const title = editing ? (editing.parentId ? '소분류 수정' : '대분류 수정') : parent ? `소분류 추가 · ${parent.name}` : '대분류 추가'

  const wrap = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }
  const submit = () =>
    wrap(async () => {
      if (editing) await categoryRepo.update(editing.id, { name: name.trim(), emoji: emoji.trim() || '🏷️', color })
      else await categoryRepo.add({ kind, name, emoji: emoji.trim(), color, parentId: parent?.id ?? null, sortOrder })
    })
  const toggleArchive = () => editing && wrap(() => categoryRepo.update(editing.id, { isArchived: !editing.isArchived }))
  const remove = () => {
    if (!editing) return
    const msg = editing.parentId
      ? `'${editing.name}' 소분류를 삭제할까요?\n이 소분류의 거래는 미분류로 바뀝니다.`
      : `'${editing.name}' 대분류를 삭제할까요?\n이 카테고리와 소분류의 거래는 모두 미분류로 바뀌고, 소분류·예산·자동분류 규칙도 함께 삭제됩니다.`
    if (!window.confirm(msg)) return
    void wrap(() => categoryRepo.remove(editing.id))
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="flex justify-center py-1">
          <CategoryBadge category={{ name: name.trim() || '이름', emoji: emoji.trim() || '🏷️', color }} size="lg" className="text-lg font-medium" />
        </div>
        <div className="grid grid-cols-[5.5rem_1fr] gap-3">
          <Field label="이모지" htmlFor="cat-emoji">
            <Input id="cat-emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="text-center text-xl" autoComplete="off" />
          </Field>
          <Field label="이름" htmlFor="cat-name">
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={parent ? '예: 카페' : '예: 식비'} autoFocus autoComplete="off" />
          </Field>
        </div>
        <div>
          <p className="text-xs font-medium text-muted mb-1">색상</p>
          <div role="radiogroup" aria-label="색상" className="grid grid-cols-8 gap-2">
            {CATEGORY_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={`색상 ${c}`}
                onClick={() => setColor(c)}
                className={cn('h-8 w-8 rounded-full transition', c === color && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={busy}>
          {editing ? '저장' : '추가'}
        </Button>
        {editing && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void toggleArchive()} disabled={busy}>
              {editing.isArchived ? '복원' : '보관'}
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              삭제
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  )
}
