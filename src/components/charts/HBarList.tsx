import { useState } from 'react'
import { formatKRW, formatPct } from '../../domain/money'
import { cn } from '../../lib/cn'
import { CategoryBadge } from '../ui/CategoryBadge'
import { DeltaBadge } from './Delta'

export interface HBarItem {
  id: string
  label: string
  emoji?: string
  color: string
  value: number
  /** 표시용 비율 0~1 (상위 합계 대비) */
  pct: number
  /** 전월 대비 증감 (없으면 표시 안 함) */
  delta?: number
  deltaPct?: number | null
  /** 보조 텍스트 (예: "지난달 ₩120,000") */
  sub?: string
  /** 소분류 등 하위 항목 — 있으면 행을 눌러 펼친다 */
  children?: HBarItem[]
}

export interface HBarListProps {
  items: HBarItem[]
  /** 강조할 항목 id */
  activeId?: string | null
  /** 행 선택 시 (같은 행을 다시 누르면 null) */
  onSelect?: (id: string | null) => void
  /** 막대 길이 기준: 최댓값 대비(max) 또는 pct 그대로 */
  scale?: 'max' | 'pct'
  emptyText?: string
  className?: string
}

function RowBody({ item, width, expanded, compact }: { item: HBarItem; width: number; expanded?: boolean; compact?: boolean }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {item.emoji ? (
            <CategoryBadge category={{ name: item.label, emoji: item.emoji, color: item.color }} size={compact ? 'sm' : 'md'} className={cn('min-w-0', compact ? 'text-xs' : 'text-sm')} />
          ) : (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} aria-hidden />
              <span className={cn('truncate', compact ? 'text-xs' : 'text-sm')}>{item.label}</span>
            </>
          )}
          {expanded !== undefined && (
            <span className="text-xs text-muted" aria-hidden>
              {expanded ? '▾' : '▸'}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className={cn('tnum block font-semibold', compact ? 'text-xs' : 'text-sm')}>{formatKRW(item.value)}</span>
          <span className="tnum block text-[11px] text-muted">
            {formatPct(item.pct)}
            {item.sub && ` · ${item.sub}`}
          </span>
        </span>
      </span>
      <span className="mt-1.5 flex items-center gap-2">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full rounded-full transition-[width]" style={{ width: `${Math.round(Math.max(0, Math.min(1, width)) * 100)}%`, background: item.color }} />
        </span>
        {item.delta !== undefined && <DeltaBadge delta={item.delta} deltaPct={item.deltaPct} className="w-32 shrink-0 text-right" title="전월 대비" />}
      </span>
    </>
  )
}

/** 비율 막대 목록 (Recharts 없이 div로 구성). 카테고리 비중, 전월 비교 등에 사용 */
export function HBarList({ items, activeId, onSelect, scale = 'max', emptyText = '내역이 없습니다', className }: HBarListProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (items.length === 0) return <p className="py-4 text-center text-sm text-muted">{emptyText}</p>
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1)
  const widthOf = (it: HBarItem, base: number) => (scale === 'pct' ? it.pct : Math.abs(it.value) / base)

  return (
    <ul className={cn('divide-y divide-border', className)}>
      {items.map((it) => {
        const children = it.children ?? []
        const hasChildren = children.length > 0
        const open = openId === it.id
        const interactive = hasChildren || Boolean(onSelect)
        const active = activeId === it.id
        const rowClass = cn('block w-full py-2 text-left', interactive && 'rounded-lg hover:bg-surface-2/60', active && 'bg-accent-soft/40')
        const childMax = Math.max(...children.map((c) => Math.abs(c.value)), 1)
        return (
          <li key={it.id}>
            {interactive ? (
              <button
                type="button"
                className={rowClass}
                aria-expanded={hasChildren ? open : undefined}
                aria-pressed={onSelect ? active : undefined}
                onClick={() => {
                  if (hasChildren) setOpenId(open ? null : it.id)
                  onSelect?.(active ? null : it.id)
                }}
              >
                <RowBody item={it} width={widthOf(it, max)} expanded={hasChildren ? open : undefined} />
              </button>
            ) : (
              <div className={rowClass}>
                <RowBody item={it} width={widthOf(it, max)} />
              </div>
            )}
            {hasChildren && open && (
              <ul className="space-y-1 pb-2 pl-8 pr-1">
                {children.map((c) => (
                  <li key={c.id} className="py-1">
                    <RowBody item={c} width={scale === 'pct' ? c.pct : Math.abs(c.value) / childMax} compact />
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
