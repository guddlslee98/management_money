import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatMonthKo, formatMonthShortKo } from '../../domain/dates'
import { formatKRW } from '../../domain/money'
import type { TrendPoint } from '../../domain/summary'
import { formatAxisKRW } from './format'
import { autoDomain, axisTick, chartColor } from './theme'
import { TooltipBox } from './TooltipBox'

export type TrendMetric = 'net' | 'cumulativeNet'

const METRIC_LABEL: Record<TrendMetric, string> = { net: '순수입', cumulativeNet: '누적 순수입' }

function TrendTooltip({ active, payload, metric }: TooltipContentProps & { metric: TrendMetric }) {
  const p = payload?.[0]?.payload as TrendPoint | undefined
  if (!active || !p) return null
  return <TooltipBox title={formatMonthKo(p.month)} rows={[{ label: METRIC_LABEL[metric], value: formatKRW(p[metric]), color: chartColor.accent }]} />
}

/** 순수입 또는 누적 순수입 추이 선 그래프 */
export function TrendLine({ points, metric = 'net', height = 200, animate = true }: { points: TrendPoint[]; metric?: TrendMetric; height?: number; animate?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 360, height }}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chartColor.border} />
        <XAxis dataKey="month" tickFormatter={formatMonthShortKo} tick={axisTick} axisLine={false} tickLine={false} interval={points.length > 12 ? 'preserveStartEnd' : 0} />
        <YAxis tickFormatter={formatAxisKRW} tick={axisTick} axisLine={false} tickLine={false} width="auto" domain={autoDomain} />
        <ReferenceLine y={0} stroke={chartColor.muted} strokeDasharray="3 3" ifOverflow="extendDomain" />
        <Tooltip content={(t) => <TrendTooltip {...t} metric={metric} />} cursor={{ stroke: chartColor.border }} />
        <Line
          dataKey={metric}
          name={METRIC_LABEL[metric]}
          type="monotone"
          stroke={chartColor.accent}
          strokeWidth={2}
          dot={{ r: 3, fill: chartColor.accent, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={animate ? 'auto' : false}
          animationDuration={500}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
