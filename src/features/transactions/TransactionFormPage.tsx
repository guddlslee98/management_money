import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Page } from '../../components/layout/AppLayout'
import { AccountPicker, AmountInput, CategoryPicker } from '../../components/pickers'
import { Button, EmptyState, Field, Input, PageHeader, Segmented, Textarea } from '../../components/ui'
import type { SegmentOption } from '../../components/ui/Segmented'
import { txRepo, ValidationError, type NewTransaction } from '../../db/repo'
import type { TxType } from '../../db/types'
import { createClassifier } from '../../domain/classify'
import { formatDateKo, isDateKey, toMonthKey, type MonthKey } from '../../domain/dates'
import { formatKRW } from '../../domain/money'
import { useCategoryMap, useClassifyRules, useTransaction } from '../../hooks/data'
import { addDays, defaultDate } from './txView'

const TYPE_OPTIONS: SegmentOption<TxType>[] = [
  { value: 'expense', label: '지출', activeClass: 'text-expense' },
  { value: 'income', label: '수입', activeClass: 'text-income' },
  { value: 'transfer', label: '이체', activeClass: 'text-transfer' },
]

interface FormValues {
  type: TxType
  amount: number | null
  date: string
  categoryId: string | null
  accountId: string | null
  toAccountId: string | null
  payee: string
  memo: string
  isRefund: boolean
}

function isTxType(s: string | null): s is TxType {
  return s === 'expense' || s === 'income' || s === 'transfer'
}

const NO_PAYEES: string[] = []
/** 자동완성용 최근 거래처 (hooks/data.ts에 없어 여기서 래핑) */
function useRecentPayees(): string[] {
  return useLiveQuery(() => txRepo.recentPayees(), [], NO_PAYEES)
}

export default function TransactionFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tx = useTransaction(id)

  if (id) {
    if (tx === undefined) {
      return (
        <>
          <PageHeader title="거래 수정" back />
          <Page>
            <p className="text-sm text-muted text-center py-6">불러오는 중…</p>
          </Page>
        </>
      )
    }
    if (tx === null) {
      return (
        <>
          <PageHeader title="거래 수정" back />
          <Page>
            <EmptyState emoji="🔍" title="거래를 찾을 수 없어요" description="이미 삭제되었을 수 있어요" action={<Button onClick={() => navigate('/transactions')}>목록으로</Button>} />
          </Page>
        </>
      )
    }
    return (
      <TransactionForm
        key={tx.id}
        mode="edit"
        txId={tx.id}
        returnMonth={tx.month}
        initial={{
          type: tx.type,
          amount: tx.amount,
          date: tx.date,
          categoryId: tx.categoryId,
          accountId: tx.accountId,
          toAccountId: tx.toAccountId,
          payee: tx.payee,
          memo: tx.memo,
          isRefund: tx.isRefund,
        }}
      />
    )
  }

  const typeParam = params.get('type')
  const date = defaultDate(params.get('date'), params.get('m'))
  return (
    <TransactionForm
      mode="new"
      returnMonth={toMonthKey(date)}
      initial={{
        type: isTxType(typeParam) ? typeParam : 'expense',
        amount: null,
        date,
        categoryId: null,
        accountId: params.get('from'),
        toAccountId: null,
        payee: '',
        memo: '',
        isRefund: false,
      }}
    />
  )
}

function TransactionForm({ mode, txId, initial, returnMonth }: { mode: 'new' | 'edit'; txId?: string; initial: FormValues; returnMonth: MonthKey }) {
  const navigate = useNavigate()
  const [v, setV] = useState<FormValues>(initial)
  const [keepGoing, setKeepGoing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setV((p) => ({ ...p, [key]: value }))

  const rules = useClassifyRules()
  const classifier = useMemo(() => createClassifier(rules), [rules])
  const catMap = useCategoryMap()
  const payees = useRecentPayees()
  const isTransfer = v.type === 'transfer'

  /** 카테고리를 아직 고르지 않았을 때 거래처/메모로 추천 */
  const suggestion = useMemo(() => {
    if (isTransfer || v.categoryId) return null
    const id = classifier.classify(v.payee, v.memo)
    const c = id ? catMap.get(id) : undefined
    return c && c.kind === v.type && !c.isArchived ? c : null
  }, [isTransfer, v.categoryId, v.payee, v.memo, v.type, classifier, catMap])

  const changeType = (t: TxType) =>
    setV((p) => ({ ...p, type: t, categoryId: t === p.type ? p.categoryId : null, isRefund: t === 'transfer' ? false : p.isRefund }))

  const save = async () => {
    if (v.amount === null || v.amount <= 0) {
      setError('금액을 입력하세요')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const input: NewTransaction = {
        type: v.type,
        date: v.date,
        amount: v.amount,
        categoryId: isTransfer ? null : v.categoryId,
        accountId: v.accountId,
        toAccountId: isTransfer ? v.toAccountId : null,
        payee: v.payee.trim(),
        memo: v.memo.trim(),
        isRefund: isTransfer ? false : v.isRefund,
      }
      const saved = mode === 'edit' && txId ? await txRepo.update(txId, input) : await txRepo.add(input)
      if (mode === 'new' && keepGoing) {
        setV((p) => ({ ...p, amount: null, payee: '', memo: '', categoryId: null, isRefund: false }))
        setNotice(`저장했어요: ${saved.payee || '거래'} ${formatKRW(saved.amount)}`)
        amountRef.current?.focus()
      } else {
        navigate(`/transactions?m=${saved.month}`)
      }
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : '저장하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!txId || !window.confirm('이 거래를 삭제할까요?')) return
    setBusy(true)
    try {
      await txRepo.remove(txId)
      navigate(`/transactions?m=${returnMonth}`)
    } catch {
      setError('삭제하지 못했어요')
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title={mode === 'edit' ? '거래 수정' : '거래 추가'} back />
      <Page>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Segmented value={v.type} onChange={changeType} options={TYPE_OPTIONS} />

          <Field label="금액" htmlFor="tx-amount">
            <AmountInput id="tx-amount" ref={amountRef} value={v.amount} onChange={(n) => set('amount', n)} autoFocus={mode === 'new'} />
          </Field>

          <Field label="날짜" htmlFor="tx-date" hint={formatDateKo(v.date, true)}>
            <div className="flex gap-2">
              <Button variant="secondary" aria-label="하루 전" onClick={() => set('date', addDays(v.date, -1))} className="h-11 w-11 px-0 shrink-0">
                ‹
              </Button>
              <Input
                id="tx-date"
                type="date"
                value={v.date}
                onChange={(e) => {
                  if (isDateKey(e.target.value)) set('date', e.target.value)
                }}
                className="flex-1 min-w-0"
              />
              <Button variant="secondary" aria-label="하루 후" onClick={() => set('date', addDays(v.date, 1))} className="h-11 w-11 px-0 shrink-0">
                ›
              </Button>
            </div>
          </Field>

          {!isTransfer && (
            <div>
              <CategoryPicker kind={v.type === 'income' ? 'income' : 'expense'} value={v.categoryId} onChange={(id) => set('categoryId', id)} includeArchived={mode === 'edit'} />
              {suggestion && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm" role="status">
                  <span className="text-muted shrink-0">추천:</span>
                  <span className="flex-1 truncate">
                    <span aria-hidden>{suggestion.emoji}</span> {suggestion.name}
                  </span>
                  <Button size="sm" onClick={() => set('categoryId', suggestion.id)} aria-label={`추천 카테고리 ${suggestion.name} 적용`}>
                    적용
                  </Button>
                </div>
              )}
            </div>
          )}

          {isTransfer ? (
            <div className="grid grid-cols-2 gap-3">
              <AccountPicker id="tx-from" label="출금 계좌" value={v.accountId} onChange={(id) => set('accountId', id)} exclude={v.toAccountId} allowNone={false} />
              <AccountPicker id="tx-to" label="입금 계좌" value={v.toAccountId} onChange={(id) => set('toAccountId', id)} exclude={v.accountId} allowNone={false} />
            </div>
          ) : (
            <AccountPicker id="tx-account" value={v.accountId} onChange={(id) => set('accountId', id)} />
          )}

          <Field label="거래처" htmlFor="tx-payee">
            <Input
              id="tx-payee"
              list="tx-payee-options"
              value={v.payee}
              onChange={(e) => set('payee', e.target.value)}
              placeholder={isTransfer ? '예: 카드대금 납부' : '예: 스타벅스'}
              autoComplete="off"
            />
            <datalist id="tx-payee-options">
              {payees.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>

          <Field label="메모" htmlFor="tx-memo">
            <Textarea id="tx-memo" value={v.memo} onChange={(e) => set('memo', e.target.value)} rows={2} placeholder="선택 사항" />
          </Field>

          {!isTransfer && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.isRefund} onChange={(e) => set('isRefund', e.target.checked)} className="h-4 w-4 accent-accent" />
              {v.type === 'expense' ? '환불 (지출에서 차감)' : '반환 (수입에서 차감)'}
            </label>
          )}

          {mode === 'new' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepGoing} onChange={(e) => setKeepGoing(e.target.checked)} className="h-4 w-4 accent-accent" />
              저장 후 계속 입력
            </label>
          )}

          {error && (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-income">
              {notice}
            </p>
          )}

          <Button type="submit" size="lg" full disabled={busy}>
            {mode === 'edit' ? '저장' : '저장'}
          </Button>
          {mode === 'edit' && (
            <Button variant="danger" full onClick={() => void remove()} disabled={busy}>
              삭제
            </Button>
          )}
        </form>
      </Page>
    </>
  )
}
