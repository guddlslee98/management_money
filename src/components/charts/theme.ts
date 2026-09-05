/**
 * 차트 색상은 CSS 변수를 그대로 참조한다 (SVG 속성에서도 var() 사용 가능).
 * 라이트/다크 전환(html.dark) 시 다시 그리지 않아도 색이 따라 바뀐다.
 */
export const chartColor = {
  income: 'var(--income)',
  expense: 'var(--expense)',
  transfer: 'var(--transfer)',
  accent: 'var(--accent)',
  warn: 'var(--warn)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  border: 'var(--border)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
} as const

/** 축 눈금 글자 스타일 */
export const axisTick = { fill: chartColor.muted, fontSize: 11 } as const

/**
 * 금액 축 범위. 'auto'는 눈금을 보기 좋게 반올림하지만 0을 포함하지 않을 수 있으므로,
 * 각 차트는 <ReferenceLine y={0} ifOverflow="extendDomain" />로 0 기준선을 범위에 강제로 포함한다.
 */
export const autoDomain: ['auto', 'auto'] = ['auto', 'auto']

/** 필요 시 CSS 변수를 실제 색상값으로 읽는다 (예: 캔버스). 브라우저가 아니면 빈 문자열 */
export function resolveCssVar(name: string): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
