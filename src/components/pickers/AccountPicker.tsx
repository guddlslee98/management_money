import { useAccounts } from '../../hooks/data'
import { Field, Select } from '../ui'

export interface AccountPickerProps {
  value: string | null
  onChange: (id: string | null) => void
  /** 목록에서 제외할 계좌 (이체의 반대편 계좌) */
  exclude?: string | null
  label?: string
  id?: string
  /** "계좌 없음"을 허용할지. false면 빈 값은 "계좌 선택" 안내로 표시 */
  allowNone?: boolean
}

/** 보관되지 않은 계좌 중에서 고른다 (현재 값이 보관된 계좌면 그 항목만 추가로 보여줌) */
export function AccountPicker({ value, onChange, exclude, label = '계좌', id = 'account-picker', allowNone = true }: AccountPickerProps) {
  const accounts = useAccounts()
  const options = accounts.filter((a) => a.id !== exclude && (!a.isArchived || a.id === value))
  return (
    <Field label={label} htmlFor={id}>
      <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{allowNone ? '계좌 없음' : '계좌 선택'}</option>
        {options.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.isArchived ? ' (보관됨)' : ''}
          </option>
        ))}
      </Select>
    </Field>
  )
}
