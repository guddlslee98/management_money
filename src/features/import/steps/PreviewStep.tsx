import { useMemo, useState } from 'react'
import { Button, Card, CardTitle, CategoryBadge, Field, Money } from '../../../components/ui'
import type { Account, Category } from '../../../db/types'
import { formatKRW } from '../../../domain/money'
import type { ParsedRow } from '../../../domain/import/profiles'
import { cn } from '../../../lib/cn'
import { AccountSelect } from '../AccountSelect'
import { CategoryPicker } from '../CategoryPicker'
import { TypeBadge } from '../TypeBadge'

const CHUNK = 200

export interface PreviewStepProps {
  rows: ParsedRow[]
  duplicates: boolean[]
  suggestions: (string | null)[]
  overrides: Map<number, string | null>
  categories: Category[]
  categoryMap: Map<string, Category>
  selected: Set<number>
  accounts: Account[]
  accountId: string | null
  counterAccountId: string | null
  importing: boolean
  onToggle: (rowIndex: number) => void
  onSelectAll: (mode: 'all' | 'none' | 'withDuplicates') => void
  onSetCategory: (rowIndex: number, categoryId: string | null, always: boolean) => void
  onCounterAccountChange: (id: string | null) => void
  onBack: () => void
  onImport: () => void
}

export function PreviewStep(p: PreviewStepProps) {
  const [limit, setLimit] = useState(CHUNK)
  const [picker, setPicker] = useState<number | null>(null)

  const stats = useMemo(() => {
    let dup = 0
    let err = 0
    let expense = 0
    let income = 0
    let transfers = 0
    p.rows.forEach((r, i) => {
      if (r.errors.length) err++
      else if (p.duplicates[i]) dup++
      if (r.type === 'transfer') transfers++
      if (!p.selected.has(r.rowIndex) || r.errors.length) return
      const v = r.isRefund ? -r.amount : r.amount
      if (r.type === 'expense') expense += v
      else if (r.type === 'income') income += v
    })
    return { dup, err, expense, income, transfers }
  }, [p.rows, p.duplicates, p.selected])

  const categoryOf = (i: number, r: ParsedRow) => (p.overrides.has(r.rowIndex) ? p.overrides.get(r.rowIndex) ?? null : p.suggestions[i])
  const pickerRow = picker === null ? null : p.rows.find((r) => r.rowIndex === picker) ?? null
  const pickerIndex = pickerRow ? p.rows.indexOf(pickerRow) : -1
  const visible = p.rows.slice(0, limit)
  const transferBlocked = stats.transfers > 0 && (!p.counterAccountId || p.counterAccountId === p.accountId)

  return (
    <>
      <Card>
        <CardTitle>3. 미리보기</CardTitle>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-surface-2 p-2">
            <div className="text-muted">선택</div>
            <div className="tnum font-semibold text-base">{p.selected.size.toLocaleString('ko-KR')}</div>
            <div className="text-muted">/ {p.rows.length.toLocaleString('ko-KR')}행</div>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <div className="text-muted">중복</div>
            <div className="tnum font-semibold text-base text-warn">{stats.dup.toLocaleString('ko-KR')}</div>
            <div className="text-muted">기본 제외</div>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <div className="text-muted">오류</div>
            <div className="tnum font-semibold text-base text-expense">{stats.err.toLocaleString('ko-KR')}</div>
            <div className="text-muted">가져올 수 없음</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted tnum">
          선택된 지출 <span className="text-expense font-medium">{formatKRW(stats.expense)}</span> · 수입 <span className="text-income font-medium">{formatKRW(stats.income)}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => p.onSelectAll('all')} aria-label="중복 제외 전체 선택">
            전체 선택
          </Button>
          <Button size="sm" variant="secondary" onClick={() => p.onSelectAll('none')} aria-label="전체 해제">
            전체 해제
          </Button>
          <Button size="sm" variant="secondary" onClick={() => p.onSelectAll('withDuplicates')} aria-label="중복 포함 전체 선택">
            중복 포함
          </Button>
        </div>
        {stats.transfers > 0 && (
          <div className="mt-3">
            <Field label="이체 상대 계좌" htmlFor="imp-counter" hint={`이체 ${stats.transfers}건 (카드대금 등)`} error={transferBlocked ? '이체를 가져오려면 다른 계좌를 고르세요' : null}>
              <AccountSelect id="imp-counter" accounts={p.accounts.filter((a) => a.id !== p.accountId)} value={p.counterAccountId} onChange={p.onCounterAccountChange} allowNone noneLabel="선택 안 함 (이체 건은 건너뜀)" />
            </Field>
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-border">
          {visible.map((r, i) => {
            const dup = p.duplicates[i]
            const err = r.errors.length > 0
            const checked = p.selected.has(r.rowIndex)
            const catId = categoryOf(i, r)
            const cat = catId ? p.categoryMap.get(catId) : undefined
            return (
              <li key={r.rowIndex} className={cn('px-3 py-2', err && 'bg-expense/5', !checked && !err && 'opacity-60')}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                    checked={checked}
                    disabled={err}
                    onChange={() => p.onToggle(r.rowIndex)}
                    aria-label={`${r.date} ${r.payee} ${formatKRW(r.amount)} 선택`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-xs text-muted shrink-0">{r.date || '날짜 없음'}</span>
                      <TypeBadge type={r.type} />
                      {r.isRefund && <span className="text-[11px] text-warn shrink-0">환불</span>}
                      {dup && <span className="rounded-md bg-warn/15 px-1.5 text-[11px] font-semibold text-warn shrink-0">중복</span>}
                      <span className="flex-1" />
                      <Money value={r.amount} tone={r.type} className="text-sm" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate text-sm">
                        {r.payee || <span className="text-muted">(거래처 없음)</span>}
                        {r.memo && <span className="text-xs text-muted"> · {r.memo}</span>}
                      </span>
                      {r.type !== 'transfer' && !err && (
                        <button type="button" onClick={() => setPicker(r.rowIndex)} className="shrink-0 rounded-lg px-1.5 py-0.5 hover:bg-surface-2 text-xs" aria-label={`${r.payee} 카테고리 변경`}>
                          <CategoryBadge category={cat} size="sm" />
                        </button>
                      )}
                    </div>
                    {err && <p className="mt-0.5 text-xs text-expense">{r.errors.join(', ')}</p>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {p.rows.length === 0 && <p className="p-4 text-sm text-muted">가져올 행이 없습니다.</p>}
        {limit < p.rows.length && (
          <div className="p-3">
            <Button variant="secondary" full onClick={() => setLimit((n) => n + CHUNK)}>
              더 보기 ({(p.rows.length - limit).toLocaleString('ko-KR')}행 남음)
            </Button>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={p.onBack} disabled={p.importing} aria-label="이전 단계">
          이전
        </Button>
        <Button className="flex-1" size="lg" onClick={p.onImport} disabled={p.importing || p.selected.size === 0}>
          {p.importing ? '가져오는 중…' : `${p.selected.size.toLocaleString('ko-KR')}건 가져오기`}
        </Button>
      </div>

      {pickerRow && (
        <CategoryPicker
          open
          kind={pickerRow.type === 'income' ? 'income' : 'expense'}
          categories={p.categories}
          value={categoryOf(pickerIndex, pickerRow)}
          payee={pickerRow.payee}
          onClose={() => setPicker(null)}
          onPick={(id, always) => {
            p.onSetCategory(pickerRow.rowIndex, id, always)
            setPicker(null)
          }}
        />
      )}
    </>
  )
}
