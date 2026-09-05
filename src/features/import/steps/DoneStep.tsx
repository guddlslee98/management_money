import { Button, Card, EmptyState } from '../../../components/ui'
import { formatMonthKo } from '../../../domain/dates'

export interface ImportResult {
  added: number
  duplicates: number
  errors: number
  /** 상대 계좌가 없어 건너뛴 이체 */
  skippedTransfers?: number
  latestMonth: string | null
}

export function DoneStep({ result, onViewTransactions, onRestart }: { result: ImportResult; onViewTransactions: () => void; onRestart: () => void }) {
  return (
    <>
      <Card>
        <EmptyState
          emoji={result.added > 0 ? '✅' : '🤔'}
          title={result.added > 0 ? `${result.added.toLocaleString('ko-KR')}건을 가져왔어요` : '가져온 거래가 없어요'}
          description={
            <span className="tnum">
              추가 {result.added.toLocaleString('ko-KR')}건 · 중복 제외 {result.duplicates.toLocaleString('ko-KR')}건 · 오류 {result.errors.toLocaleString('ko-KR')}건{result.skippedTransfers ? ` · 이체 건너뜀 ${result.skippedTransfers.toLocaleString('ko-KR')}건 (상대 계좌 미지정)` : ''}
            </span>
          }
        />
      </Card>
      <div className="space-y-2">
        <Button full size="lg" onClick={onViewTransactions} disabled={result.added === 0}>
          {result.latestMonth ? `${formatMonthKo(result.latestMonth)} 거래 보기` : '거래 보기'}
        </Button>
        <Button full variant="secondary" onClick={onRestart}>
          다른 파일 가져오기
        </Button>
      </div>
    </>
  )
}
