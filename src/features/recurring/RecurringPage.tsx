import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Page } from '../../components/layout/AppLayout'
import { Button, Card, CardTitle, EmptyState, Money, PageHeader } from '../../components/ui'
import { recurringRepo, txRepo } from '../../db/repo'
import type { Account, Category, RecurringRule } from '../../db/types'
import { currentMonthKey, formatDateKo, formatMonthKo, todayKey } from '../../domain/dates'
import { nextOccurrence } from '../../domain/recurring'
import { useAccountMap, useAccounts, useCategories, useCategoryMap, useRecurringRules } from '../../hooks/data'
import { cn } from '../../lib/cn'
import { ChoiceSheet } from '../../components/ui/ChoiceSheet'
import { RecurringForm } from './RecurringForm'
import { accountName, describeDay, TYPE_LABEL, TYPE_TEXT_CLASS } from './helpers'

export default function RecurringPage() {
  const rules = useRecurringRules()
  const categories = useCategories()
  const catMap = useCategoryMap()
  const accounts = useAccounts()
  const accMap = useAccountMap()
  const ruleKey = rules.map((r) => r.id).join(',')
  const counts = useLiveQuery(async () => {
    const entries = await Promise.all(rules.map(async (r) => [r.id, (await txRepo.byRecurringRule(r.id)).length] as const))
    return new Map(entries)
  }, [ruleKey])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [deleting, setDeleting] = useState<RecurringRule | null>(null)
  const [generated, setGenerated] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (rule: RecurringRule) => {
    setEditing(rule)
    setFormOpen(true)
  }
  const generateNow = async () => {
    setGenerating(true)
    try {
      setGenerated(await recurringRepo.generateDue())
    } finally {
      setGenerating(false)
    }
  }

  const today = todayKey()

  return (
    <>
      <PageHeader
        title="반복 거래"
        back="/more"
        right={
          <Button size="sm" onClick={openNew} aria-label="반복 거래 추가">
            + 추가
          </Button>
        }
      />
      <Page>
        <Card>
          <CardTitle>자동 등록 안내</CardTitle>
          <ul className="text-sm space-y-1 list-disc pl-4">
            <li>발생일이 지나면 앱을 열 때 자동으로 거래가 등록됩니다.</li>
            <li>미래 거래는 미리 만들지 않습니다. 발생일 당일 이후에 생성됩니다.</li>
            <li>규칙을 끄면(비활성) 그 이후 발생분은 만들지 않습니다.</li>
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={generateNow} disabled={generating}>
              지금 생성
            </Button>
            {generated !== null && (
              <span role="status" className="text-sm text-muted tnum">
                {generated}건 생성됨
              </span>
            )}
          </div>
        </Card>

        {rules.length === 0 ? (
          <Card>
            <EmptyState emoji="🔁" title="반복 거래가 없습니다" description="월세·구독·급여처럼 매달 반복되는 거래를 등록해 두면 자동으로 기록됩니다." action={<Button onClick={openNew}>반복 거래 추가</Button>} />
          </Card>
        ) : (
          <Card className="p-0 divide-y divide-border overflow-hidden">
            {rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} catMap={catMap} accMap={accMap} count={counts?.get(rule.id)} today={today} onEdit={() => openEdit(rule)} onToggle={(isActive) => recurringRepo.update(rule.id, { isActive })} />
            ))}
          </Card>
        )}

        <RecurringForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          rule={editing}
          categories={categories}
          accounts={accounts}
          currentMonth={currentMonthKey()}
          onDelete={(rule) => {
            setFormOpen(false)
            setDeleting(rule)
          }}
        />

        <ChoiceSheet
          open={deleting !== null}
          onClose={() => setDeleting(null)}
          title="반복 거래 삭제"
          description={deleting ? `"${ruleTitle(deleting, catMap)}" 규칙을 삭제합니다.\n이미 생성된 거래 ${counts?.get(deleting.id) ?? 0}건을 어떻게 할까요?` : undefined}
          choices={[
            { label: '규칙만 삭제 (생성된 거래는 유지)', variant: 'secondary', onSelect: () => (deleting ? recurringRepo.remove(deleting.id, false) : undefined) },
            { label: '생성된 거래도 삭제', variant: 'danger', onSelect: () => (deleting ? recurringRepo.remove(deleting.id, true) : undefined) },
          ]}
        />
      </Page>
    </>
  )
}

function ruleTitle(rule: RecurringRule, catMap: Map<string, Category>): string {
  if (rule.payee) return rule.payee
  if (rule.type === 'transfer') return '이체'
  return rule.categoryId ? (catMap.get(rule.categoryId)?.name ?? '미분류') : '미분류'
}

function RuleRow({ rule, catMap, accMap, count, today, onEdit, onToggle }: { rule: RecurringRule; catMap: Map<string, Category>; accMap: Map<string, Account>; count: number | undefined; today: string; onEdit: () => void; onToggle: (isActive: boolean) => Promise<void> }) {
  const next = nextOccurrence(rule, today)
  const cat = rule.categoryId ? catMap.get(rule.categoryId) : undefined
  const title = ruleTitle(rule, catMap)
  const where = rule.type === 'transfer' ? `${accountName(accMap, rule.accountId)} → ${accountName(accMap, rule.toAccountId)}` : [cat ? `${cat.emoji} ${cat.name}` : '미분류', accountName(accMap, rule.accountId)].join(' · ')
  return (
    <div className={cn('px-4 py-3 space-y-1', !rule.isActive && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left" aria-label={`${title} 수정`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn('text-[11px] font-semibold shrink-0', TYPE_TEXT_CLASS[rule.type])}>{TYPE_LABEL[rule.type]}</span>
              <span className="font-medium truncate">{title}</span>
            </span>
            <Money value={rule.amount} tone={rule.type} />
          </div>
          <p className="text-xs text-muted truncate">{where}</p>
          <p className="text-xs text-muted tnum">
            {describeDay(rule.dayOfMonth)}
            {' · '}
            {next ? `다음 ${formatDateKo(next)}` : rule.isActive ? '예정 없음' : '비활성'}
            {' · '}
            {count === undefined ? '…' : `${count}건 생성`}
            {rule.endMonth && ` · ${formatMonthKo(rule.endMonth)}까지`}
          </p>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={rule.isActive}
          aria-label={`${title} 활성`}
          onClick={() => void onToggle(!rule.isActive)}
          className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition', rule.isActive ? 'bg-accent' : 'bg-border')}
        >
          <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-xs transition-transform', rule.isActive && 'translate-x-5')} />
        </button>
      </div>
    </div>
  )
}
