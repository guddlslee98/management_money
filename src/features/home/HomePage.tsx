import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { DeltaBadge, DonutChart, HBarList, type DonutSlice, type HBarItem } from '../../components/charts'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, CategoryBadge, EmptyState, Money, MonthPicker, PageHeader, ProgressBar } from '../../components/ui'
import { UNCATEGORIZED, type Category, type Transaction } from '../../db/types'
import { budgetUsage, type BudgetStatus } from '../../domain/budget'
import { currentMonthKey, formatDateKo, formatMonthKo, prevMonth } from '../../domain/dates'
import { formatKRW, formatPct } from '../../domain/money'
import { summarizeMonth, type CategoryShare } from '../../domain/summary'
import { useBudgets, useCategoryMap, useMonthTransactions } from '../../hooks/data'
import { useMonth } from '../../hooks/useMonth'
import { cn } from '../../lib/cn'
import { deltaOf, type Delta } from './delta'

const STATUS_COLOR: Record<BudgetStatus, string> = { ok: 'var(--income)', warn: 'var(--warn)', over: 'var(--expense)' }
const STATUS_TEXT: Record<BudgetStatus, string> = { ok: 'text-text', warn: 'text-warn', over: 'text-expense' }

type CategoryLike = Pick<Category, 'id' | 'name' | 'emoji' | 'color'>

function categoryOf(catMap: Map<string, Category>, id: string): CategoryLike {
  return catMap.get(id) ?? UNCATEGORIZED
}

/** CategoryShare → 목록 항목. 대분류에 직접 기록된 거래는 "○○ 일반"으로 표시 */
function toItem(share: CategoryShare, catMap: Map<string, Category>, parent?: CategoryShare): HBarItem {
  const c = categoryOf(catMap, share.categoryId)
  const label = parent && share.categoryId === parent.categoryId ? `${c.name} 일반` : c.name
  const showChildren = !parent && share.children.length > 0 && !(share.children.length === 1 && share.children[0].categoryId === share.categoryId)
  return {
    id: share.categoryId,
    label,
    emoji: c.emoji,
    color: c.color,
    value: share.amount,
    pct: share.pct,
    delta: share.delta,
    deltaPct: share.deltaPct,
    children: showChildren ? share.children.map((ch) => toItem(ch, catMap, share)) : undefined,
  }
}

function StatCard({ label, value, tone, delta, goodWhen, extra, wide }: { label: string; value: number; tone: 'income' | 'expense' | 'auto'; delta: Delta | null; goodWhen: 'up' | 'down'; extra?: ReactNode; wide?: boolean }) {
  if (wide) {
    return (
      <Card className="col-span-2 flex min-w-0 items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{label}</p>
          <Money value={value} tone={tone} className="block truncate text-lg leading-tight" />
        </div>
        <div className="shrink-0 text-right">
          {delta && <DeltaBadge delta={delta.delta} deltaPct={delta.deltaPct} goodWhen={goodWhen} className="block" title="전월 대비" />}
          {extra && <p className="mt-0.5 text-[11px] text-muted">{extra}</p>}
        </div>
      </Card>
    )
  }
  return (
    <Card className="min-w-0 p-3">
      <p className="text-xs text-muted">{label}</p>
      <Money value={value} tone={tone} className="block truncate text-base leading-tight" />
      {delta && <DeltaBadge delta={delta.delta} deltaPct={delta.deltaPct} goodWhen={goodWhen} stacked className="mt-1 block" title="전월 대비" />}
      {extra && <p className="mt-0.5 text-[11px] text-muted">{extra}</p>}
    </Card>
  )
}

function RecentRow({ tx, category }: { tx: Transaction; category: CategoryLike | null }) {
  const title = tx.payee || tx.memo || (tx.type === 'transfer' ? '이체' : (category?.name ?? UNCATEGORIZED.name))
  let amount: ReactNode
  if (tx.type === 'transfer') amount = <Money value={tx.amount} tone="transfer" />
  else if (tx.type === 'expense') amount = tx.isRefund ? <Money value={tx.amount} tone="income" signed /> : <Money value={-tx.amount} tone="expense" signed />
  else amount = tx.isRefund ? <Money value={-tx.amount} tone="expense" signed /> : <Money value={tx.amount} tone="income" signed />
  return (
    <li>
      <Link to={`/transactions/${tx.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
        <span className="tnum w-16 shrink-0 text-xs text-muted">{formatDateKo(tx.date)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{title}</span>
          <span className="block truncate text-[11px] text-muted">
            {tx.type === 'transfer' ? '이체' : (category?.name ?? UNCATEGORIZED.name)}
            {tx.isRefund && (tx.type === 'income' ? ' · 반환' : ' · 환불')}
          </span>
        </span>
        <span className="shrink-0 text-sm">{amount}</span>
      </Link>
    </li>
  )
}

export default function HomePage() {
  const { month, prev, next, today } = useMonth()
  const navigate = useNavigate()
  const txs = useMonthTransactions(month)
  const prevTxs = useMonthTransactions(prevMonth(month))
  const catMap = useCategoryMap()
  const categories = useMemo(() => [...catMap.values()], [catMap])
  const budgets = useBudgets()
  const [activeCat, setActiveCat] = useState<string | null>(null)

  const summary = useMemo(() => summarizeMonth(month, txs ?? [], categories, prevTxs ?? null), [month, txs, categories, prevTxs])
  const usage = useMemo(() => {
    // 보관된 카테고리의 예산은 예산 화면에 행이 없으므로 여기서도 제외
    const active = new Set(categories.filter((c) => c.kind === 'expense' && c.parentId === null && !c.isArchived).map((c) => c.id))
    return budgetUsage(budgets.filter((b) => active.has(b.categoryId)), month, summary.byCategory).slice(0, 3)
  }, [budgets, categories, month, summary])
  const donutData = useMemo<DonutSlice[]>(
    () =>
      summary.byCategory.map((s) => {
        const c = categoryOf(catMap, s.categoryId)
        return { id: s.categoryId, name: c.name, value: s.amount, color: c.color }
      }),
    [summary, catMap],
  )
  const shareItems = useMemo<HBarItem[]>(() => summary.byCategory.map((s) => toItem(s, catMap)), [summary, catMap])

  const isCurrent = month === currentMonthKey()
  const title = isCurrent ? '이번 달' : month === prevMonth(currentMonthKey()) ? '지난 달' : formatMonthKo(month)
  const newTxHref = `/transactions/new?m=${month}`
  const listHref = `/transactions?m=${month}`
  const p = summary.prev
  const dIncome = p ? deltaOf(summary.income, p.income) : null
  const dExpense = p ? deltaOf(summary.expense, p.expense) : null
  const dNet = p ? deltaOf(summary.net, p.net) : null
  const recent = txs?.slice(0, 5) ?? []

  return (
    <>
      <PageHeader title={title} subtitle={txs ? `거래 ${summary.txCount}건` : undefined} />
      <Page>
        <MonthPicker month={month} onPrev={prev} onNext={next} onToday={today} />

        {txs === undefined ? (
          <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
        ) : txs.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🧾"
              title="거래가 없어요"
              description={`${formatMonthKo(month)}에 기록된 거래가 없습니다`}
              action={
                <div className="flex gap-2">
                  <Button onClick={() => navigate(newTxHref)}>거래 추가</Button>
                  <Button variant="secondary" onClick={() => navigate('/more/import')}>
                    파일 가져오기
                  </Button>
                </div>
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="수입" value={summary.income} tone="income" delta={dIncome} goodWhen="up" />
              <StatCard label="지출" value={summary.expense} tone="expense" delta={dExpense} goodWhen="down" />
              <StatCard label="순수입" value={summary.net} tone="auto" delta={dNet} goodWhen="up" extra={summary.savingsRate !== null && `저축률 ${formatPct(summary.savingsRate)}`} wide />
            </div>

            <Button size="lg" full onClick={() => navigate(newTxHref)} aria-label="거래 추가">
              + 거래 추가
            </Button>

            <Card>
              <CardTitle>지출 구성</CardTitle>
              <DonutChart data={donutData} total={summary.expense} centerLabel="총 지출" activeId={activeCat} onActiveChange={setActiveCat} />
              <HBarList items={shareItems} activeId={activeCat} onSelect={setActiveCat} emptyText="이번 달 지출이 없습니다" className="mt-2" />
            </Card>

            {usage.length > 0 && (
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <CardTitle className="mb-0">예산</CardTitle>
                  <Link to={`/budgets?m=${month}`} className="text-xs text-accent">
                    전체 보기 ›
                  </Link>
                </div>
                <ul className="space-y-3">
                  {usage.map((u) => {
                    const c = categoryOf(catMap, u.categoryId)
                    return (
                      <li key={u.categoryId}>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <CategoryBadge category={c} size="sm" className="min-w-0" />
                          <span className="tnum shrink-0 text-xs text-muted">
                            <span className={cn('font-semibold', STATUS_TEXT[u.status])}>{formatKRW(u.spent)}</span> / {formatKRW(u.budget)}
                          </span>
                        </div>
                        <ProgressBar ratio={u.ratio} color={STATUS_COLOR[u.status]} className="mt-1.5" />
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )}

            <Card className="p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 pb-1 pt-4">
                <CardTitle className="mb-0">최근 거래</CardTitle>
                <Link to={listHref} className="text-xs text-accent">
                  전체 보기 ›
                </Link>
              </div>
              <ul className="divide-y divide-border">
                {recent.map((tx) => (
                  <RecentRow key={tx.id} tx={tx} category={tx.categoryId ? categoryOf(catMap, tx.categoryId) : null} />
                ))}
              </ul>
            </Card>
          </>
        )}
      </Page>
    </>
  )
}
