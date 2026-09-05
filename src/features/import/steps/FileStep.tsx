import { useRef, useState, type DragEvent } from 'react'
import { Button, Card, CardTitle, Field } from '../../../components/ui'
import type { Account } from '../../../db/types'
import type { ParsedFile } from '../../../domain/import/parse'
import { cn } from '../../../lib/cn'
import { AccountSelect } from '../AccountSelect'
import formatsMd from '../FORMATS.md?raw'

export interface LoadedSummary {
  name: string
  parsed: ParsedFile
  rowCount: number
  headerCount: number
  profileName: string
  confidence: number
}

const KIND_LABEL: Record<ParsedFile['kind'], string> = { csv: 'CSV/텍스트', xlsx: '엑셀(xlsx)', xls: '엑셀(xls)', html: 'HTML 표(.xls)' }
const ENC_LABEL: Record<ParsedFile['encoding'], string> = { 'utf-8': 'UTF-8', 'utf-16': 'UTF-16', 'euc-kr': 'EUC-KR', binary: '' }

const SOURCES = ['뱅크샐러드 가계부 내역', '편한가계부', '토스뱅크', '카카오뱅크', 'KB국민은행', '신한은행', '삼성카드', '신한카드', 'KB국민카드', '현대카드', '그 외 CSV/엑셀(열 직접 지정)']

export function FileStep({
  loading,
  error,
  loaded,
  accounts,
  accountId,
  onFile,
  onAccountChange,
  onNext,
}: {
  loading: boolean
  error: string | null
  loaded: LoadedSummary | null
  accounts: Account[]
  accountId: string | null
  onFile: (file: File) => void
  onAccountChange: (id: string | null) => void
  onNext: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <>
      <Card>
        <CardTitle>1. 파일 선택</CardTitle>
        <div
          role="presentation"
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn('rounded-2xl border-2 border-dashed p-6 text-center transition', dragging ? 'border-accent bg-accent-soft/40' : 'border-border bg-surface-2/40')}
        >
          <div className="text-3xl mb-2" aria-hidden>
            📥
          </div>
          <p className="text-sm">은행·카드·가계부 앱에서 내려받은 파일을 여기에 끌어다 놓거나</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="가져올 파일"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
          <Button className="mt-3" onClick={() => inputRef.current?.click()} disabled={loading} aria-label="파일 선택">
            {loading ? '읽는 중…' : '파일 선택'}
          </Button>
          <p className="mt-2 text-xs text-muted">.csv .txt .xls .xlsx · 비밀번호가 걸린 엑셀은 먼저 비밀번호 없이 다시 저장하세요</p>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-expense">
            {error}
          </p>
        )}
        {loaded && (
          <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm space-y-1">
            <p className="font-medium truncate">{loaded.name}</p>
            <p className="text-muted text-xs">
              {KIND_LABEL[loaded.parsed.kind]}
              {ENC_LABEL[loaded.parsed.encoding] && ` · ${ENC_LABEL[loaded.parsed.encoding]}`}
              {loaded.parsed.sheetName && ` · 시트 "${loaded.parsed.sheetName}"`} · {loaded.headerCount}열 · {loaded.rowCount.toLocaleString('ko-KR')}행
            </p>
            <p className="text-xs">
              감지된 출처: <span className="font-medium">{loaded.profileName}</span>
              <span className="text-muted"> ({Math.round(loaded.confidence * 100)}%)</span>
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>어느 계좌의 내역인가요?</CardTitle>
        <Field label="계좌" htmlFor="import-account" hint={loaded ? '감지된 출처에 맞춰 골랐어요' : undefined}>
          <AccountSelect id="import-account" accounts={accounts} value={accountId} onChange={onAccountChange} />
        </Field>
        {accounts.length === 0 && <p className="mt-2 text-xs text-warn">계좌가 없습니다. 더보기 › 계좌 관리에서 먼저 추가하세요.</p>}
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-muted">지원하는 파일 형식</summary>
          <ul className="mt-2 text-sm list-disc pl-5 space-y-0.5">
            {SOURCES.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">자세한 열 구성과 받는 방법</summary>
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed">{formatsMd}</pre>
          </details>
        </details>
      </Card>

      <Button full size="lg" onClick={onNext} disabled={!loaded || !accountId || loading}>
        다음: 열 매핑
      </Button>
    </>
  )
}
