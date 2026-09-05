import { useMemo, useState } from 'react'
import { Pie, PieChart, ResponsiveContainer, Sector, Tooltip, type PieSectorDataItem, type PieSectorShapeProps, type TooltipContentProps } from 'recharts'
import { formatKRW, formatPct } from '../../domain/money'
import { TooltipBox } from './TooltipBox'

export interface DonutSlice {
  id: string
  name: string
  value: number
  /** 카테고리 색 (hex) */
  color: string
}

export interface DonutChartProps {
  data: DonutSlice[]
  /** 중앙에 표시할 합계이자 비율 계산 기준 */
  total: number
  centerLabel?: string
  /** 외부에서 강조할 조각 id (목록과 연동). undefined면 내부 상태 사용 */
  activeId?: string | null
  onActiveChange?: (id: string | null) => void
  height?: number
  animate?: boolean
}

type SliceDatum = DonutSlice & { fill: string }

function sliceOf(d: PieSectorDataItem | PieSectorShapeProps): SliceDatum | undefined {
  return d.payload as SliceDatum | undefined
}

/** 지출 구성 도넛: 대분류별 비율, 호버/탭 시 조각 강조 + 중앙 텍스트 전환 */
export function DonutChart({ data, total, centerLabel = '총 지출', activeId, onActiveChange, height = 220, animate = true }: DonutChartProps) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const slices = useMemo<SliceDatum[]>(() => data.filter((d) => d.value > 0).map((d) => ({ ...d, fill: d.color })), [data])
  const currentId = activeId ?? selectedId ?? hoverId
  const active = currentId ? (slices.find((s) => s.id === currentId) ?? null) : null

  const toggle = (id: string | null) => {
    const next = currentId === id ? null : id
    setSelectedId(next)
    onActiveChange?.(next)
  }

  const renderSector = (p: PieSectorShapeProps) => {
    const id = sliceOf(p)?.id
    const isActive = p.isActive || (currentId != null && id === currentId)
    const dimmed = currentId != null && !isActive
    return (
      <Sector
        cx={p.cx}
        cy={p.cy}
        innerRadius={p.innerRadius}
        outerRadius={isActive ? (p.outerRadius ?? 0) + 6 : p.outerRadius}
        startAngle={p.startAngle}
        endAngle={p.endAngle}
        cornerRadius={p.cornerRadius}
        fill={p.fill}
        opacity={dimmed ? 0.4 : 1}
        stroke="none"
        style={{ transition: 'opacity .15s' }}
      />
    )
  }

  const renderTooltip = (t: TooltipContentProps) => {
    const s = t.payload?.[0]?.payload as SliceDatum | undefined
    if (!t.active || !s) return null
    return (
      <TooltipBox
        title={s.name}
        rows={[
          { label: '금액', value: formatKRW(s.value), color: s.color },
          { label: '비율', value: formatPct(total > 0 ? s.value / total : 0) },
        ]}
      />
    )
  }

  if (slices.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
        지출 내역이 없습니다
      </div>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
        <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="84%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            cornerRadius={4}
            stroke="none"
            isAnimationActive={animate ? 'auto' : false}
            animationBegin={0}
            animationDuration={600}
            shape={renderSector}
            onClick={(d) => toggle(sliceOf(d)?.id ?? null)}
            onMouseEnter={(d) => setHoverId(sliceOf(d)?.id ?? null)}
            onMouseLeave={() => setHoverId(null)}
          />
          <Tooltip content={renderTooltip} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
        <span className="max-w-full truncate text-xs text-muted">{active ? active.name : centerLabel}</span>
        <span className="tnum text-base font-bold">{formatKRW(active ? active.value : total)}</span>
        {active && total > 0 && <span className="tnum text-xs text-muted">{formatPct(active.value / total)}</span>}
      </div>
    </div>
  )
}
