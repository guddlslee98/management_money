import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CategoryBarChart, HBarList, MonthlyBarChart, TrendLine, type HBarItem, type TrendMetric } from '../../components/charts'
import { Page } from '../../components/layout/AppLayout'
import { Card, CardTitle, Field, MonthPicker, PageHeader, Segmented, Select } from '../../components/ui'
import { UNCATEGORIZED } from '../../db/types'
import { currentMonthKey, formatMonthKo, formatMonthShortKo, lastNMonths, prevMonth, type MonthKey } from '../../domain/dates'
import { formatKRW, formatPct } from '../../domain/money'
import { averageTotals, monthlyTrend, summarizeMonth, type MonthTotals } from '../../domain/summary'
import { useCategoryMap, useTransactionsInMonths } from '../../hooks/data'
import { useMonth } from '../../hooks/useMonth'
import { cn } from '../../lib/cn'
import { categoryTrend, periodLength, savingsRateOf, sumTotals, type Period } from './reportStats'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '6', label: '6개월' },
  { value: '12', label: '12개월' },
  { value: 'ytd', label: '올해' },
]
const METRIC_OPTIONS: { value: TrendMetric; label: string }[] = [
  { value: 'net', label: '월별' },
  { value: 'cumulativeNet', label: '누적' },
]

function TotalsCells({ t }: { t: MonthTotals }) {
  const sr = savingsRateOf(t)
  return (
    <>
      <td className="px-1.5 py-1.5 text-right text-income">{formatKRW(t.income)}</td>
      <td className="px-1.5 py-1.5 text-right text-expense">{formatKRW(t.expense)}</td>
      <td className="py-1.5 pl-1.5 pr-3 text-right">
        <span className={cn('block font-semibold', t.net < 0 && 'text-expense')}>{formatKRW(t.net)}</span>
        <span className="block text-[10px] font-normal text-muted">{sr === null ? '–' : formatPct(sr)}</span>
      </td>
    </>
  )
}

export default function ReportsPage() {
  const { month, prev, next, today } = useMonth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState<Period>('6')
  const [metric, setMetric] = useState<TrendMetric>('net')
  const [pickedCat, setPickedCat] = useState('')

  const n = periodLength(period, month)
  // 전월 비교(이번 달 vs 지난달)를 위해 기간보다 한 달 더 조회
  const queryMonths = useMemo(() => lastNMonths(month, n + 1), [month, n])
  const txs = useTransactionsInMonths(queryMonths)
  const catMap = useCategoryMap()
  const categories = useMemo(() => [...catMap.values()], [catMap])

  const trend = useMemo(() => monthlyTrend(month, n, txs ?? []), [month, n, txs])
  const average = useMemo(() => averageTotals(trend), [trend])
  const total = useMemo(() => sumTotals(trend), [trend])
  const compare = useMemo(() => summarizeMonth(month, txs ?? [], categories, txs ?? []), [month, txs, categories])

  const expenseTops = useMemo(() => categories.filter((c) => c.kind === 'expense' && c.parentId === null && !c.isArchived), [categories])
  const selectedCat = expenseTops.some((c) => c.id === pickedCat) ? pickedCat : (compare.byCategory.find((s) => expenseTops.some((c) => c.id === s.categoryId))?.categoryId ?? expenseTops[0]?.id ?? '')
  const selectedCategory = catMap.get(selectedCat)
  const months = useMemo(() => trend.map((p) => p.month), [trend])
  const catTrend = useMemo(() => (selectedCat ? categoryTrend(months, txs ?? [], categories, selectedCat) : null), [months, txs, categories, selectedCat])

  const compareItems = useMemo<HBarItem[]>(
    () =>
      compare.byCategory.slice(0, 8).map((s) => {
        const c = catMap.get(s.categoryId) ?? UNCATEGORIZED
        return { id: s.categoryId, label: c.name, emoji: c.emoji, color: c.color, value: s.amount, pct: s.pct, delta: s.delta, deltaPct: s.deltaPct, sub: `지난달 ${formatKRW(s.prevAmount)}` }
      }),
    [compare, catMap],
  )

  const isCurrent = month === currentMonthKey()
  const rangeLabel = trend.length > 0 ? `${formatMonthKo(trend[0].month)} ~ ${formatMonthKo(month)}` : formatMonthKo(month)
  const txHref = (m: MonthKey) => `/transactions?m=${m}`

  return (
    <>
      <PageHeader title="리포트" subtitle={rangeLabel} />
      <Page>
        <MonthPicker month={month} onPrev={prev} onNext={next} onToday={today} />
        <Segmented value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />

        {txs === undefined ? (
          <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
        ) : (
          <>
            <Card>
              <CardTitle>월별 수입·지출</CardTitle>
              <MonthlyBarChart points={trend} />
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between gap-2">
                <CardTitle className="mb-0">순수입 추이</CardTitle>
                <Segmented value={metric} onChange={setMetric} options={METRIC_OPTIONS} className="w-36" />
              </div>
              <TrendLine points={trend} metric={metric} />
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 pt-4">
                <CardTitle>월별 요약</CardTitle>
              </div>
              <div className="overflow-x-auto">
                <table className="tnum w-full whitespace-nowrap text-[11px]">
                  <thead>
                    <tr className="text-muted">
                      <th className="py-1.5 pl-3 pr-1.5 text-left font-medium">월</th>
                      <th className="px-1.5 py-1.5 text-right font-medium">수입</th>
                      <th className="px-1.5 py-1.5 text-right font-medium">지출</th>
                      <th className="py-1.5 pl-1.5 pr-3 text-right font-medium">순수입 · 저축률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trend.map((p) => (
                      <tr key={p.month} className="cursor-pointer hover:bg-surface-2" onClick={() => navigate(txHref(p.month))}>
                        <td className="py-2 pl-3 pr-1.5">
                          <Link to={txHref(p.month)} className="font-medium text-accent" title={formatMonthKo(p.month)} onClick={(e) => e.stopPropagation()}>
                            {formatMonthShortKo(p.month)}
                          </Link>
                        </td>
                        <TotalsCells t={p} />
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border">
                    <tr className="text-muted">
                      <td className="py-2 pl-3 pr-1.5 font-medium">평균</td>
                      <TotalsCells t={average} />
                    </tr>
                    <tr className="font-semibold">
                      <td className="py-2 pl-3 pr-1.5">합계</td>
                      <TotalsCells t={total} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card>
              <CardTitle>카테고리 추이</CardTitle>
              {expenseTops.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">지출 카테고리가 없습니다</p>
              ) : (
                <>
                  <Field label="대분류" htmlFor="report-category">
                    <Select id="report-category" value={selectedCat} onChange={(e) => setPickedCat(e.target.value)}>
                      {expenseTops.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {catTrend && selectedCategory && (
                    <div className="mt-3">
                      <CategoryBarChart points={catTrend.points} name={selectedCategory.name} color={selectedCategory.color} average={catTrend.average} />
                      <p className="mt-1 text-center text-xs text-muted">
                        월 평균 <span className="tnum font-medium text-text">{formatKRW(catTrend.average)}</span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>

            <Card>
              <CardTitle>{isCurrent ? '이번 달 vs 지난달' : `${formatMonthShortKo(month)} vs ${formatMonthShortKo(prevMonth(month))}`}</CardTitle>
              <HBarList items={compareItems} emptyText="이번 달 지출이 없습니다" />
            </Card>
          </>
        )}
      </Page>
    </>
  )
}
