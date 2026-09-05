import { memo, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CategoryBadge, EmptyState, Input, Money, MonthPicker, PageHeader, Segmented } from '../../components/ui'
import type { SegmentOption } from '../../components/ui/Segmented'
import type { Account, Category, Transaction } from '../../db/types'
import { formatDateKo } from '../../domain/dates'
import { formatKRW } from '../../domain/money'
import { summarizeMonth } from '../../domain/summary'
import { useAccountMap, useCategories, useMonthTransactions } from '../../hooks/data'
import { useMonth } from '../../hooks/useMonth'
import { displayAmount, filterTransactions, groupByDate, type DayGroup, type TxFilter } from './txView'

const FILTERS: SegmentOption<TxFilter>[] = [
  { value: 'all', label: '전체' },
  { value: 'expense', label: '지출', activeClass: 'text-expense' },
  { value: 'income', label: '수입', activeClass: 'text-income' },
  { value: 'transfer', label: '이체', activeClass: 'text-transfer' },
]

const EMPTY: Transaction[] = []

export default function TransactionsPage() {
  const { month, prev, next, today } = useMonth()
  const navigate = useNavigate()
  const txs = useMonthTransactions(month)
  const categories = useCategories()
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const accMap = useAccountMap()
  const [filter, setFilter] = useState<TxFilter>('all')
  const [query, setQuery] = useState('')

  const loaded = txs !== undefined
  const all = txs ?? EMPTY
  const summary = useMemo(() => summarizeMonth(month, all, categories), [month, all, categories])
  const visible = useMemo(() => filterTransactions(all, filter, query), [all, filter, query])
  const groups = useMemo(() => groupByDate(visible), [visible])
  const newHref = `/transactions/new?m=${month}`

  return (
    <>
      <PageHeader title="거래 내역" subtitle={loaded ? `${summary.txCount}건` : undefined} />
      <Page className="pb-28">
        <MonthPicker month={month} onPrev={prev} onNext={next} onToday={today} />

        <Card className="grid grid-cols-3 divide-x divide-border p-0 py-3 text-center" aria-label="월 요약">
          <Stat label="수입">
            <Money value={summary.income} tone="income" />
          </Stat>
          <Stat label="지출">
            <Money value={summary.expense} tone="expense" />
          </Stat>
          <Stat label="순수입">
            <Money value={summary.net} tone="auto" signed />
          </Stat>
        </Card>

        <Segmented value={filter} onChange={setFilter} options={FILTERS} />
        <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="거래처·메모 검색" aria-label="거래처·메모 검색" autoComplete="off" />

        {!loaded ? (
          <p className="text-sm text-muted text-center py-6">불러오는 중…</p>
        ) : all.length === 0 ? (
          <EmptyState emoji="🧾" title="이 달에는 거래가 없어요" description="첫 거래를 추가해 보세요" action={<Button onClick={() => navigate(newHref)}>거래 추가</Button>} />
        ) : groups.length === 0 ? (
          <EmptyState emoji="🔍" title="조건에 맞는 거래가 없어요" description="필터나 검색어를 바꿔 보세요" />
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <DayCard key={g.date} group={g} catMap={catMap} accMap={accMap} />
            ))}
          </div>
        )}
      </Page>

      <div className="fixed inset-x-0 z-30 pointer-events-none" style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-lg px-4 flex justify-end">
          <Link
            to={newHref}
            aria-label="거래 추가"
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white text-3xl leading-none shadow-lg transition active:scale-95"
          >
            +
          </Link>
        </div>
      </div>
    </>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-2 min-w-0">
      <div className="text-xs text-muted mb-0.5">{label}</div>
      <div className="text-sm truncate">{children}</div>
    </div>
  )
}

const DayCard = memo(function DayCard({ group, catMap, accMap }: { group: DayGroup; catMap: Map<string, Category>; accMap: Map<string, Account> }) {
  return (
    <section aria-label={formatDateKo(group.date)}>
      <div className="flex items-baseline justify-between px-1 pb-1 text-xs text-muted">
        <span className="font-medium">{formatDateKo(group.date)}</span>
        {group.expenseTotal !== 0 && <span className="tnum">지출 {formatKRW(group.expenseTotal)}</span>}
      </div>
      <Card className="p-0 divide-y divide-border overflow-hidden">
        {group.items.map((tx) => (
          <TxRow
            key={tx.id}
            tx={tx}
            category={tx.categoryId ? catMap.get(tx.categoryId) : undefined}
            account={tx.accountId ? accMap.get(tx.accountId) : undefined}
            toAccount={tx.toAccountId ? accMap.get(tx.toAccountId) : undefined}
          />
        ))}
      </Card>
    </section>
  )
})

const TRANSFER_BADGE = { name: '이체', emoji: '🔁', color: '#7c3aed' }

function TxRow({ tx, category, account, toAccount }: { tx: Transaction; category?: Category; account?: Account; toAccount?: Account }) {
  const isTransfer = tx.type === 'transfer'
  const title = tx.payee || tx.memo || (isTransfer ? '이체' : (category?.name ?? '미분류'))
  const subtitle = isTransfer
    ? `이체 · ${account?.name ?? '계좌 없음'} → ${toAccount?.name ?? '계좌 없음'}`
    : [account?.name ?? '계좌 없음', tx.payee && tx.memo ? tx.memo : null].filter(Boolean).join(' · ')
  const tags: string[] = []
  if (tx.isRefund) tags.push(tx.type === 'income' ? '반환' : '환불')
  if (tx.source === 'import') tags.push('가져옴')
  if (tx.source === 'recurring') tags.push('반복')

  return (
    <Link to={`/transactions/${tx.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
      {isTransfer ? (
        <CategoryBadge category={TRANSFER_BADGE} className="w-[6.5rem] shrink-0 text-xs text-transfer" />
      ) : (
        <CategoryBadge category={category} className="w-[6.5rem] shrink-0 text-xs" />
      )}
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <Money value={displayAmount(tx)} signed={!isTransfer} tone={isTransfer ? 'transfer' : tx.type} className="text-sm" />
        {tags.length > 0 && (
          <span className="mt-0.5 flex justify-end gap-1">
            {tags.map((t) => (
              <span key={t} className="rounded bg-surface-2 px-1 text-[10px] leading-4 text-muted">
                {t}
              </span>
            ))}
          </span>
        )}
      </span>
    </Link>
  )
}
