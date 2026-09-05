import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, EmptyState, Money, PageHeader } from '../../components/ui'
import { accountRepo, txRepo } from '../../db/repo'
import type { Account, Category, Transaction } from '../../db/types'
import { accountBalances, netWorth } from '../../domain/accounts'
import { formatDateKo } from '../../domain/dates'
import { useAccounts, useCategoryMap } from '../../hooks/data'
import { cn } from '../../lib/cn'
import { ChoiceSheet } from '../recurring/ChoiceSheet'
import { TYPE_LABEL } from '../recurring/helpers'
import { AccountForm } from './AccountForm'
import { accountTypeEmoji, accountTypeLabel, amountForAccount, recentForAccount } from './helpers'

export default function AccountsPage() {
  const accounts = useAccounts()
  const txs = useLiveQuery(() => txRepo.all(), [])
  const catMap = useCategoryMap()
  const balances = useMemo(() => accountBalances(accounts, txs ?? []), [accounts, txs])
  const net = useMemo(() => netWorth(accounts, balances), [accounts, balances])
  const active = accounts.filter((a) => !a.isArchived)
  const archived = accounts.filter((a) => a.isArchived)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (a: Account) => {
    setEditing(a)
    setFormOpen(true)
  }

  const rowProps = (a: Account) => ({
    account: a,
    balance: balances.get(a.id) ?? a.initialBalance,
    recent: txs ? recentForAccount(txs, a.id) : undefined,
    catMap,
    expanded: expanded === a.id,
    onToggle: () => setExpanded((cur) => (cur === a.id ? null : a.id)),
    onEdit: () => openEdit(a),
    onArchive: () => accountRepo.update(a.id, { isArchived: !a.isArchived }),
    onDelete: () => setDeleting(a),
  })

  return (
    <>
      <PageHeader
        title="계좌 관리"
        back="/more"
        right={
          <Button size="sm" onClick={openNew} aria-label="계좌 추가">
            + 추가
          </Button>
        }
      />
      <Page>
        <Card>
          <CardTitle>순자산</CardTitle>
          <Money value={net} tone="auto" className="text-2xl" />
          <p className="mt-1 text-xs text-muted">보관하지 않은 계좌 {active.length}개의 잔액 합계. 카드 사용액은 음수로 잡히고, 카드대금 납부는 은행→카드 이체로 기록하세요.</p>
        </Card>

        {accounts.length === 0 ? (
          <Card>
            <EmptyState emoji="🏦" title="계좌가 없습니다" description="현금·은행·카드 등 돈이 오가는 곳을 등록하세요." action={<Button onClick={openNew}>계좌 추가</Button>} />
          </Card>
        ) : (
          <>
            {active.length > 0 && (
              <Card className="p-0 divide-y divide-border overflow-hidden">
                {active.map((a) => (
                  <AccountRow key={a.id} {...rowProps(a)} />
                ))}
              </Card>
            )}
            {archived.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <button type="button" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived} className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-surface-2">
                  <span>
                    보관된 계좌 <span className="text-muted tnum">({archived.length})</span>
                  </span>
                  <span className="text-muted" aria-hidden>
                    {showArchived ? '▴' : '▾'}
                  </span>
                </button>
                {showArchived && (
                  <div className="divide-y divide-border border-t border-border opacity-80">
                    {archived.map((a) => (
                      <AccountRow key={a.id} {...rowProps(a)} />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        <AccountForm open={formOpen} onClose={() => setFormOpen(false)} account={editing} />

        <ChoiceSheet
          open={deleting !== null}
          onClose={() => setDeleting(null)}
          title="계좌 삭제"
          description={deleting ? `"${deleting.name}" 계좌를 삭제합니다.\n거래는 남고 계좌 연결만 해제됩니다. 잔액 기록이 필요하면 삭제 대신 보관하세요.` : undefined}
          choices={[{ label: '삭제', variant: 'danger', onSelect: () => (deleting ? accountRepo.remove(deleting.id) : undefined) }]}
        />
      </Page>
    </>
  )
}

function AccountRow({ account, balance, recent, catMap, expanded, onToggle, onEdit, onArchive, onDelete }: { account: Account; balance: number; recent: Transaction[] | undefined; catMap: Map<string, Category>; expanded: boolean; onToggle: () => void; onEdit: () => void; onArchive: () => Promise<void>; onDelete: () => void }) {
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: `${account.color}26` }} aria-hidden>
          {accountTypeEmoji(account.type)}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium truncate">{account.name}</span>
          <span className="block text-xs text-muted">
            {accountTypeLabel(account.type)}
            {account.isArchived && ' · 보관됨'}
          </span>
        </span>
        <Money value={balance} tone="auto" />
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link to={`/transactions/new?from=${encodeURIComponent(account.id)}`} className="inline-flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-medium text-white">
              + 거래
            </Link>
            <Link to={`/transactions/new?type=transfer&from=${encodeURIComponent(account.id)}`} className="inline-flex h-8 items-center rounded-lg bg-surface-2 border border-border px-3 text-sm font-medium text-transfer">
              이체
            </Link>
            <Button size="sm" variant="secondary" onClick={onEdit} aria-label={`${account.name} 수정`}>
              수정
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void onArchive()} aria-label={`${account.name} ${account.isArchived ? '보관 해제' : '보관'}`}>
              {account.isArchived ? '보관 해제' : '보관'}
            </Button>
            <Button size="sm" variant="ghost" className="text-expense" onClick={onDelete} aria-label={`${account.name} 삭제`}>
              삭제
            </Button>
          </div>

          <div>
            <p className="text-xs font-medium text-muted mb-1">최근 거래</p>
            {recent === undefined ? (
              <p className="text-xs text-muted">불러오는 중…</p>
            ) : recent.length === 0 ? (
              <p className="text-xs text-muted">이 계좌의 거래가 아직 없습니다.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm bg-surface">
                    <span className="text-xs text-muted tnum w-[5.5rem] shrink-0 whitespace-nowrap">{formatDateKo(t.date)}</span>
                    <span className={cn('flex-1 min-w-0 truncate', t.type === 'transfer' && 'text-transfer')}>{t.payee || (t.categoryId ? (catMap.get(t.categoryId)?.name ?? '미분류') : TYPE_LABEL[t.type])}</span>
                    <Money value={amountForAccount(t, account.id)} tone={t.type === 'transfer' ? 'transfer' : 'auto'} signed className="text-sm" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
