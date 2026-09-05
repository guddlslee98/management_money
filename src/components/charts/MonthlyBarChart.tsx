import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatMonthKo, formatMonthShortKo } from '../../domain/dates'
import { formatKRW } from '../../domain/money'
import type { TrendPoint } from '../../domain/summary'
import { ChartLegend } from './ChartLegend'
import { formatAxisKRW } from './format'
import { autoDomain, axisTick, chartColor } from './theme'
import { TooltipBox } from './TooltipBox'

function MonthTooltip({ active, payload }: TooltipContentProps) {
  const p = payload?.[0]?.payload as TrendPoint | undefined
  if (!active || !p) return null
  return (
    <TooltipBox
      title={formatMonthKo(p.month)}
      rows={[
        { label: '수입', value: formatKRW(p.income), color: chartColor.income },
        { label: '지출', value: formatKRW(p.expense), color: chartColor.expense },
        { label: '순수입', value: formatKRW(p.net), color: chartColor.accent },
      ]}
    />
  )
}

/** 월별 수입 vs 지출 막대 + 순수입 선 */
export function MonthlyBarChart({ points, height = 220, animate = true }: { points: TrendPoint[]; height?: number; animate?: boolean }) {
  const anim = animate ? 'auto' : false
  return (
    <div>
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 360, height }}>
        <ComposedChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={chartColor.border} />
          <XAxis dataKey="month" tickFormatter={formatMonthShortKo} tick={axisTick} axisLine={false} tickLine={false} interval={points.length > 12 ? 'preserveStartEnd' : 0} />
          <YAxis tickFormatter={formatAxisKRW} tick={axisTick} axisLine={false} tickLine={false} width="auto" domain={autoDomain} />
          <ReferenceLine y={0} stroke={chartColor.muted} ifOverflow="extendDomain" />
          <Tooltip content={MonthTooltip} cursor={{ fill: chartColor.surface2 }} />
          <Bar dataKey="income" name="수입" fill={chartColor.income} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={anim} animationDuration={500} />
          <Bar dataKey="expense" name="지출" fill={chartColor.expense} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={anim} animationDuration={500} />
          <Line
            dataKey="net"
            name="순수입"
            type="monotone"
            stroke={chartColor.accent}
            strokeWidth={2}
            dot={{ r: 2.5, fill: chartColor.accent, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={anim}
            animationDuration={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <ChartLegend
        items={[
          { label: '수입', color: chartColor.income },
          { label: '지출', color: chartColor.expense },
          { label: '순수입', color: chartColor.accent, kind: 'line' },
        ]}
      />
    </div>
  )
}
