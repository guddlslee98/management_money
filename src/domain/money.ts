/** 원화(KRW)는 정수 단위로만 다룬다. */

const krw = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
})

const plain = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 1234567 -> "₩1,234,567" */
export function formatKRW(amount: number): string {
  return krw.format(Math.round(amount))
}

/** 1234567 -> "1,234,567" (기호 없음) */
export function formatNumber(amount: number): string {
  return plain.format(Math.round(amount))
}

/** 부호 포함 표기: +₩1,000 / -₩1,000 */
export function formatSigned(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${sign}${formatKRW(Math.abs(amount))}`
}

/** "1,234,567원", "₩1,234,567", "-1,234", "1.234.567" 등을 정수로 파싱. 실패 시 null */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input) : null
  const s = input.trim()
  if (!s) return null
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /^−/.test(s)
  const digits = s.replace(/[^0-9.]/g, '')
  if (!digits) return null
  // 천단위 구분자가 "."인 경우(1.234.567)도 허용: 소수점이 2개 이상이면 구분자로 간주
  const dotCount = (digits.match(/\./g) ?? []).length
  const normalized = dotCount >= 2 ? digits.replace(/\./g, '') : digits
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  const v = Math.round(n)
  return negative ? -v : v
}

/** 비율(0~1)을 "12.3%"로 */
export function formatPct(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return '0%'
  return `${(ratio * 100).toFixed(digits)}%`
}
