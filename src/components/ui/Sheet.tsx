import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** 모바일 바텀시트 높이 제한 */
  className?: string
}

/** 모바일: 바텀시트, 데스크톱: 가운데 모달 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="닫기" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-surface border border-border shadow-xl',
          'pb-[max(1rem,env(safe-area-inset-bottom))]',
          className,
        )}
      >
        <div className="sticky top-0 bg-surface/95 backdrop-blur px-4 pt-3 pb-2 border-b border-border flex items-center justify-between">
          <div className="text-base font-semibold">{title}</div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-surface-2 text-muted" aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
