import { formatNumber } from '../../domain/money'

function short(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/**
 * 차트 축 눈금용 축약 표기 (정수 원 기준).
 * 1_200_000 → "120만", 15_000 → "1.5만", 800 → "800", 150_000_000 → "1.5억"
 */
export function formatAxisKRW(n: number): string {
  if (!Number.isFinite(n)) return ''
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs < 10_000) return `${sign}${formatNumber(abs)}`
  const man = abs / 10_000
  if (Math.round(man * 10) / 10 < 10_000) return `${sign}${short(man)}만`
  return `${sign}${short(abs / 100_000_000)}억`
}
