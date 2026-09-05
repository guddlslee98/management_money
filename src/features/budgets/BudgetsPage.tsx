import { useMemo, useState } from 'react'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, CategoryBadge, EmptyState, Money, MonthPicker, PageHeader, ProgressBar, Segmented } from '../../components/ui'
import { budgetRepo } from '../../db/repo'
import { BUDGET_DEFAULT_MONTH, budgetUsage, statusFor, totalBudget } from '../../domain/budget'
import { formatMonthKo, prevMonth } from '../../domain/dates'
import { formatKRW, formatPct } from '../../domain/money'
import { summarizeMonth } from '../../domain/summary'
import { useBudgets, useCategories, useTransactionsInMonths } from '../../hooks/data'
import { useMonth } from '../../hooks/useMonth'
import { ChoiceSheet } from '../../components/ui/ChoiceSheet'
import { BudgetAmountInput } from './BudgetAmountInput'
import { barColor, budgetRows, fillFromPrevious, type BudgetRowModel, type BudgetScope, expenseParents } from './helpers'

export default function BudgetsPage() {
  const { month, prev, next, today } = useMonth()
  const pm = prevMonth(month)
  const categories = useCategories()
  const budgets = useBudgets()
  const txs = useTransactionsInMonths([pm, month])
  const [scope, setScope] = useState<BudgetScope>('default')
  const [showUnbudgeted, setShowUnbudgeted] = useState(false)
  const [fillOpen, setFillOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const summary = useMemo(() => summarizeMonth(month, txs ?? [], categories, txs ?? []), [month, txs, categories])
  const prevSummary = useMemo(() => summarizeMonth(pm, txs ?? [], categories), [pm, txs, categories])
  // 보관된 카테고리의 예산은 화면에 행이 없으므로 총 예산에서도 제외한다
  const activeBudgets = useMemo(() => {
    const ids = new Set(expenseParents(categories).map((c) => c.id))
    return budgets.filter((b) => ids.has(b.categoryId))
  }, [categories, budgets])
  const usages = useMemo(() => budgetUsage(activeBudgets, month, summary.byCategory), [activeBudgets, month, summary])
  const total = useMemo(() => totalBudget(usages), [usages])
  const rows = useMemo(() => budgetRows(categories, activeBudgets, month, usages, summary.byCategory), [categories, activeBudgets, month, usages, summary])
  const budgeted = rows.filter((r) => r.usage !== null)
  const unbudgeted = rows.filter((r) => r.usage === null)
  const fillCandidates = useMemo(() => fillFromPrevious(categories, activeBudgets, prevSummary.byCategory), [categories, activeBudgets, prevSummary])

  const writeMonth = scope === 'month' ? month : BUDGET_DEFAULT_MONTH
  const setBudget = (categoryId: string, amount: number) => budgetRepo.set(categoryId, writeMonth, amount)
  const clearOverride = (categoryId: string) => budgetRepo.set(categoryId, month, 0)

  const applyFill = async () => {
    for (const c of fillCandidates) await budgetRepo.set(c.categoryId, BUDGET_DEFAULT_MONTH, c.amount)
    setNotice(`${fillCandidates.length}개 카테고리의 기본 예산을 채웠습니다`)
  }

  const remaining = total.budget - total.spent
  const loading = txs === undefined

  return (
    <>
      <PageHeader title="예산" subtitle={`${formatMonthKo(month)} 지출 대분류별 예산`} />
      <Page>
        <MonthPicker month={month} onPrev={prev} onNext={next} onToday={today} />

        <Card>
          <CardTitle>총 예산 vs 지출</CardTitle>
          {total.budget > 0 ? (
            <>
              <div className="flex items-end justify-between gap-2">
                <div>
                  <Money value={total.spent} tone="expense" className="text-2xl" />
                  <span className="text-sm text-muted"> / {formatKRW(total.budget)}</span>
                </div>
                <span className="text-sm text-muted tnum">{formatPct(total.ratio, 0)}</span>
              </div>
              <ProgressBar ratio={total.ratio} color={barColor(statusFor(total.ratio), 'var(--accent)')} className="mt-2 h-3" />
              <p className="mt-2 text-sm">
                {remaining >= 0 ? (
                  <>
                    남은 금액 <Money value={remaining} tone="neutral" />
                  </>
                ) : (
                  <>
                    <Money value={-remaining} tone="expense" /> 초과
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">아직 설정한 예산이 없습니다. 아래에서 카테고리별 예산을 입력하세요.</p>
          )}
          <p className="mt-3 text-xs text-muted">기본 예산은 매달 적용, 이번 달 전용 예산은 이 달에만 적용됩니다.</p>
        </Card>

        <div className="space-y-2">
          <Segmented<BudgetScope>
            value={scope}
            onChange={setScope}
            options={[
              { value: 'default', label: '기본 예산' },
              { value: 'month', label: `${formatMonthKo(month)}만` },
            ]}
          />
          <p className="text-xs text-muted px-1">{scope === 'default' ? '입력한 예산이 매달 적용됩니다.' : `입력한 예산이 ${formatMonthKo(month)}에만 적용됩니다. 비우면 기본 예산으로 돌아갑니다.`}</p>
        </div>

        {notice && (
          <p role="status" className="text-sm text-accent px-1">
            {notice}
          </p>
        )}

        {rows.length === 0 ? (
          <Card>
            <EmptyState emoji="🎯" title="지출 카테고리가 없습니다" description="카테고리 관리에서 지출 대분류를 먼저 만들어 주세요." />
          </Card>
        ) : (
          <>
            {budgeted.length > 0 && (
              <Card className="p-0 divide-y divide-border overflow-hidden">
                {budgeted.map((r) => (
                  <BudgetRow key={r.category.id} row={r} scope={scope} loading={loading} onCommit={(amount) => setBudget(r.category.id, amount)} onClearOverride={() => clearOverride(r.category.id)} />
                ))}
              </Card>
            )}

            {unbudgeted.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <button type="button" onClick={() => setShowUnbudgeted((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-surface-2" aria-expanded={showUnbudgeted}>
                  <span>
                    예산 없는 카테고리 <span className="text-muted tnum">({unbudgeted.length})</span>
                  </span>
                  <span className="text-muted" aria-hidden>
                    {showUnbudgeted ? '▴' : '▾'}
                  </span>
                </button>
                {showUnbudgeted && (
                  <div className="divide-y divide-border border-t border-border">
                    {unbudgeted.map((r) => (
                      <BudgetRow key={r.category.id} row={r} scope={scope} loading={loading} onCommit={(amount) => setBudget(r.category.id, amount)} onClearOverride={() => clearOverride(r.category.id)} />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        <Button variant="secondary" full onClick={() => setFillOpen(true)} disabled={fillCandidates.length === 0}>
          지난달 지출을 예산으로 채우기
        </Button>
        {fillCandidates.length === 0 && rows.length > 0 && <p className="text-xs text-muted text-center -mt-2">기본 예산이 없는 카테고리 중 {formatMonthKo(pm)} 지출이 있는 것이 없습니다.</p>}

        <ChoiceSheet
          open={fillOpen}
          onClose={() => setFillOpen(false)}
          title="지난달 지출을 예산으로 채우기"
          description={`${formatMonthKo(pm)} 지출을 만 원 단위로 올림해 기본 예산이 없는 ${fillCandidates.length}개 카테고리에 넣습니다. 이미 있는 기본 예산은 바뀌지 않습니다.`}
          choices={[{ label: `${fillCandidates.length}개 카테고리 채우기`, onSelect: applyFill }]}
        />
      </Page>
    </>
  )
}

function BudgetRow({ row, scope, loading, onCommit, onClearOverride }: { row: BudgetRowModel; scope: BudgetScope; loading: boolean; onCommit: (amount: number) => Promise<void>; onClearOverride: () => Promise<void> }) {
  const { category, spent, usage, defaultAmount, monthAmount, hasOverride } = row
  const inputValue = scope === 'month' ? monthAmount : defaultAmount
  const placeholder = scope === 'month' && defaultAmount > 0 ? `기본 ${formatKRW(defaultAmount)}` : '없음'
  const status = usage?.status ?? null
  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <CategoryBadge category={category} className="min-w-0 font-medium" />
        <BudgetAmountInput value={inputValue} label={`${category.name} 예산`} placeholder={placeholder} onCommit={onCommit} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          지출 {loading ? '…' : <Money value={spent} tone={spent > 0 ? 'expense' : 'neutral'} className="font-medium" />}
          {usage && <span> / 예산 {formatKRW(usage.budget)}</span>}
        </span>
        {usage &&
          (usage.remaining >= 0 ? (
            <span className={status === 'warn' ? 'text-warn' : ''}>남음 {formatKRW(usage.remaining)}</span>
          ) : (
            <span className="text-expense font-medium">초과 {formatKRW(-usage.remaining)}</span>
          ))}
      </div>
      {usage && <ProgressBar ratio={usage.ratio} color={barColor(status, category.color)} />}
      {hasOverride && (
        <div className="flex items-center gap-1 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft text-accent px-2 py-0.5">
            이번 달 전용 <span className="tnum">{formatKRW(monthAmount)}</span>
            <button type="button" onClick={() => void onClearOverride()} aria-label={`${category.name} 이번 달 전용 예산 삭제`} className="ml-0.5 h-4 w-4 rounded-full hover:bg-accent/20 leading-none">
              ✕
            </button>
          </span>
          {scope === 'default' && defaultAmount > 0 && <span className="text-muted">기본 {formatKRW(defaultAmount)} 대신 적용</span>}
        </div>
      )}
    </div>
  )
}
