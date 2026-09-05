import { Select } from '../../components/ui'
import type { Account, AccountType } from '../../db/types'

const TYPE_LABEL: Record<AccountType, string> = {
  cash: '현금',
  bank: '은행',
  card: '카드',
  savings: '저축',
  investment: '투자',
  other: '기타',
}

export function AccountSelect({
  id,
  accounts,
  value,
  onChange,
  allowNone,
  noneLabel = '선택 안 함',
}: {
  id?: string
  accounts: Account[]
  value: string | null
  onChange: (id: string | null) => void
  allowNone?: boolean
  noneLabel?: string
}) {
  const list = accounts.filter((a) => !a.isArchived)
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}>
      {(allowNone || list.length === 0) && <option value="">{list.length === 0 ? '계좌가 없습니다' : noneLabel}</option>}
      {list.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {TYPE_LABEL[a.type]}
        </option>
      ))}
    </Select>
  )
}
