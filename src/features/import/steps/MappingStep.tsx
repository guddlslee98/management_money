import { useMemo } from 'react'
import { Button, Card, CardTitle, Field, Input, Money, Select } from '../../../components/ui'
import { applyMapping, PROFILES, type ColumnMapping, type ProfileId } from '../../../domain/import/profiles'
import { TypeBadge } from '../TypeBadge'

type ColumnKey = 'date' | 'time' | 'payee' | 'memo' | 'amount' | 'outflow' | 'inflow' | 'typeColumn' | 'statusColumn' | 'categoryMajor' | 'categoryMinor'

function ColumnSelect({ id, headers, value, onChange }: { id: string; headers: string[]; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Select id={id} value={value === null ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}>
      <option value="">(없음)</option>
      {headers.map((h, i) => (
        <option key={i} value={i}>
          {i + 1}. {h}
        </option>
      ))}
    </Select>
  )
}

function ValuesInput({ id, values, onChange }: { id: string; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <Input
      id={id}
      value={values.join(', ')}
      placeholder="쉼표로 구분"
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      }
    />
  )
}

export function MappingStep({
  headers,
  body,
  profileId,
  detectedName,
  confidence,
  mapping,
  mappingSource,
  saved,
  onProfileChange,
  onMappingChange,
  onSave,
  onBack,
  onNext,
}: {
  headers: string[]
  body: string[][]
  profileId: ProfileId
  detectedName: string
  confidence: number
  mapping: ColumnMapping
  mappingSource: 'saved' | 'profile'
  saved: boolean
  onProfileChange: (id: ProfileId) => void
  onMappingChange: (m: ColumnMapping) => void
  onSave: () => void
  onBack: () => void
  onNext: () => void
}) {
  const set = <K extends keyof ColumnMapping>(key: K, value: ColumnMapping[K]) => onMappingChange({ ...mapping, [key]: value })
  const setCol = (key: ColumnKey) => (v: number | null) => set(key, v)

  const preview = useMemo(() => applyMapping(body.slice(0, 40), mapping).slice(0, 5), [body, mapping])
  const ready = mapping.date !== null && (mapping.amountMode === 'single' ? mapping.amount !== null : mapping.outflow !== null || mapping.inflow !== null)

  return (
    <>
      <Card>
        <CardTitle>2. 열 매핑</CardTitle>
        <p className="text-xs text-muted mb-3">
          감지된 출처: <span className="font-medium text-text">{detectedName}</span> ({Math.round(confidence * 100)}%)
          {mappingSource === 'saved' && <span className="ml-1 text-accent">· 저장된 매핑을 불러왔어요</span>}
        </p>
        <div className="space-y-3">
          <Field label="출처(프로필)" htmlFor="imp-profile">
            <Select id="imp-profile" value={profileId} onChange={(e) => onProfileChange(e.target.value as ProfileId)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="날짜 열" htmlFor="imp-date" error={mapping.date === null ? '날짜 열은 필수입니다' : null}>
            <ColumnSelect id="imp-date" headers={headers} value={mapping.date} onChange={setCol('date')} />
          </Field>
          <Field label="거래처 열" htmlFor="imp-payee">
            <ColumnSelect id="imp-payee" headers={headers} value={mapping.payee} onChange={setCol('payee')} />
          </Field>
          <Field label="메모 열" htmlFor="imp-memo">
            <ColumnSelect id="imp-memo" headers={headers} value={mapping.memo} onChange={setCol('memo')} />
          </Field>

          <fieldset>
            <legend className="block text-xs font-medium text-muted mb-1">금액 열 구성</legend>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ['single', '단일 금액 열'],
                  ['split', '출금·입금 분리 열'],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex items-center gap-2 rounded-xl border border-border px-3 h-11 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40">
                  <input type="radio" name="imp-amount-mode" value={mode} checked={mapping.amountMode === mode} onChange={() => set('amountMode', mode)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {mapping.amountMode === 'single' ? (
            <>
              <Field label="금액 열" htmlFor="imp-amount" error={mapping.amount === null ? '금액 열은 필수입니다' : null}>
                <ColumnSelect id="imp-amount" headers={headers} value={mapping.amount} onChange={setCol('amount')} />
              </Field>
              <fieldset>
                <legend className="block text-xs font-medium text-muted mb-1">부호 규칙 (유형 열이 없을 때)</legend>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 h-11 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40">
                    <input
                      type="radio"
                      name="imp-sign"
                      checked={mapping.negativeIsExpense && !mapping.cardDefaultsToExpense}
                      onChange={() => onMappingChange({ ...mapping, negativeIsExpense: true, cardDefaultsToExpense: false })}
                    />
                    음수=지출, 양수=수입 (은행)
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 h-11 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40">
                    <input
                      type="radio"
                      name="imp-sign"
                      checked={!mapping.negativeIsExpense || mapping.cardDefaultsToExpense}
                      onChange={() => onMappingChange({ ...mapping, negativeIsExpense: false, cardDefaultsToExpense: true })}
                    />
                    모두 지출, 음수=환불 (카드)
                  </label>
                </div>
              </fieldset>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Field label="출금 열" htmlFor="imp-out">
                <ColumnSelect id="imp-out" headers={headers} value={mapping.outflow} onChange={setCol('outflow')} />
              </Field>
              <Field label="입금 열" htmlFor="imp-in">
                <ColumnSelect id="imp-in" headers={headers} value={mapping.inflow} onChange={setCol('inflow')} />
              </Field>
            </div>
          )}

          <Field label="유형 열 (지출/수입/이체)" htmlFor="imp-type" hint="선택">
            <ColumnSelect id="imp-type" headers={headers} value={mapping.typeColumn} onChange={setCol('typeColumn')} />
          </Field>
          {mapping.typeColumn !== null && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="지출 값" htmlFor="imp-v-exp">
                <ValuesInput id="imp-v-exp" values={mapping.expenseValues} onChange={(v) => set('expenseValues', v)} />
              </Field>
              <Field label="수입 값" htmlFor="imp-v-inc">
                <ValuesInput id="imp-v-inc" values={mapping.incomeValues} onChange={(v) => set('incomeValues', v)} />
              </Field>
              <Field label="이체 값" htmlFor="imp-v-tr">
                <ValuesInput id="imp-v-tr" values={mapping.transferValues} onChange={(v) => set('transferValues', v)} />
              </Field>
            </div>
          )}
          <Field label="취소/상태 열" htmlFor="imp-status" hint="취소·거절이면 환불로">
            <ColumnSelect id="imp-status" headers={headers} value={mapping.statusColumn} onChange={setCol('statusColumn')} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="대분류 열" htmlFor="imp-major">
              <ColumnSelect id="imp-major" headers={headers} value={mapping.categoryMajor} onChange={setCol('categoryMajor')} />
            </Field>
            <Field label="소분류 열" htmlFor="imp-minor">
              <ColumnSelect id="imp-minor" headers={headers} value={mapping.categoryMinor} onChange={setCol('categoryMinor')} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>미리보기 (처음 5행)</CardTitle>
        {preview.length === 0 ? (
          <p className="text-sm text-muted">읽을 수 있는 행이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {preview.map((r) => (
              <li key={r.rowIndex} className="py-2 flex items-center gap-2">
                <span className="tnum text-xs text-muted w-20 shrink-0">{r.date || '—'}</span>
                <TypeBadge type={r.type} />
                <span className="flex-1 min-w-0 truncate">
                  {r.payee || <span className="text-muted">(거래처 없음)</span>}
                  {r.memo && <span className="text-muted text-xs"> · {r.memo}</span>}
                </span>
                <Money value={r.amount} tone={r.type} />
                {r.errors.length > 0 && <span className="text-xs text-expense shrink-0">{r.errors[0]}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} aria-label="이전 단계">
          이전
        </Button>
        <Button variant="secondary" onClick={onSave} aria-label="매핑 저장">
          {saved ? '저장됨 ✓' : '매핑 저장'}
        </Button>
        <Button className="flex-1" onClick={onNext} disabled={!ready}>
          다음: 미리보기
        </Button>
      </div>
    </>
  )
}
