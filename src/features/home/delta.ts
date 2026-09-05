export interface Delta {
  delta: number
  /** 증감률 (0~1 기준). 이전 값이 0이면 null */
  deltaPct: number | null
}

/** 전월 대비 증감: current - previous, 증감률은 |previous| 기준 */
export function deltaOf(current: number, previous: number): Delta {
  const delta = current - previous
  return { delta, deltaPct: previous !== 0 ? delta / Math.abs(previous) : null }
}
