import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatMonthKo, formatMonthShortKo, type MonthKey } from '../../domain/dates'
import { formatKRW } from '../../domain/money'
import { formatAxisKRW } from './format'
import { autoDomain, axisTick, chartColor } from './theme'
import { TooltipBox } from './TooltipBox'

export interface CategoryPoint {
  month: MonthKey
  value: number
}

function CategoryTooltip({ active, payload, name, color }: TooltipContentProps & { name: string; color: string }) {
  const p = payload?.[0]?.payload as CategoryPoint | undefined
  if (!active || !p) return null
  return <TooltipBox title={formatMonthKo(p.month)} rows={[{ label: name, value: formatKRW(p.value), color }]} />
}

/** 한 카테고리의 월별 금액 막대 + 평균선 */
export function CategoryBarChart({
  points,
  name,
  color,
  average,
  height = 180,
  animate = true,
}: {
  points: CategoryPoint[]
  name: string
  color: string
  average?: number
  height?: number
  animate?: boolean
}) {
  if (points.every((p) => p.value === 0)) {
    return (
      <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
        기간 내 지출이 없습니다
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 360, height }}>
      <BarChart data={points} margin={{ top: 16, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={chartColor.border} />
        <XAxis dataKey="month" tickFormatter={formatMonthShortKo} tick={axisTick} axisLine={false} tickLine={false} interval={points.length > 12 ? 'preserveStartEnd' : 0} />
        <YAxis tickFormatter={formatAxisKRW} tick={axisTick} axisLine={false} tickLine={false} width="auto" domain={autoDomain} />
        <ReferenceLine y={0} stroke={chartColor.muted} ifOverflow="extendDomain" />
        {average !== undefined && (
          <ReferenceLine
            y={average}
            stroke={chartColor.muted}
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
            label={{ value: `평균 ${formatAxisKRW(average)}`, position: 'insideTopRight', fill: chartColor.muted, fontSize: 10 }}
          />
        )}
        <Tooltip content={(t) => <CategoryTooltip {...t} name={name} color={color} />} cursor={{ fill: chartColor.surface2 }} />
        <Bar dataKey="value" name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={animate ? 'auto' : false} animationDuration={500} />
      </BarChart>
    </ResponsiveContainer>
  )
}
