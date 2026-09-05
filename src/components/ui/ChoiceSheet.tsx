import type { ReactNode } from 'react'
import { Button, Sheet } from './index'

export interface Choice {
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  onSelect: () => void | Promise<void>
}

/**
 * 확인/선택 바텀시트. 삭제 확인처럼 한 가지 선택이거나, "규칙만 삭제 / 거래도 삭제"처럼 여러 선택일 때 사용.
 * 선택 후에는 자동으로 닫힌다.
 */
export function ChoiceSheet({ open, onClose, title, description, choices, cancelLabel = '취소' }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; choices: Choice[]; cancelLabel?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {description && <p className="text-sm text-muted mb-4 whitespace-pre-line">{description}</p>}
      <div className="space-y-2">
        {choices.map((c) => (
          <Button
            key={c.label}
            full
            size="lg"
            variant={c.variant ?? 'primary'}
            onClick={async () => {
              await c.onSelect()
              onClose()
            }}
          >
            {c.label}
          </Button>
        ))}
        <Button full size="lg" variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </Sheet>
  )
}
