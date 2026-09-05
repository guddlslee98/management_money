/**
 * 날짜는 문자열('YYYY-MM-DD', 'YYYY-MM')로만 다룬다.
 * Date 객체의 시간대 문제를 피하기 위해 문자열 연산을 기본으로 한다.
 */

export type MonthKey = string // 'YYYY-MM'
export type DateKey = string // 'YYYY-MM-DD'

const pad2 = (n: number) => String(n).padStart(2, '0')

export function isDateKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(`${y}-${pad2(m)}`)
}

export function isMonthKey(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false
  const m = Number(s.slice(5, 7))
  return m >= 1 && m <= 12
}

export function toMonthKey(date: DateKey): MonthKey {
  return date.slice(0, 7)
}

export function monthKeyOf(d: Date): MonthKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function dateKeyOf(d: Date): DateKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayKey(now: Date = new Date()): DateKey {
  return dateKeyOf(now)
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return monthKeyOf(now)
}

export function daysInMonth(month: MonthKey): number {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  return new Date(y, m, 0).getDate()
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + n
  const ny = y + Math.floor(m / 12)
  const nm = ((m % 12) + 12) % 12
  return `${ny}-${pad2(nm + 1)}`
}

export function prevMonth(month: MonthKey): MonthKey {
  return addMonths(month, -1)
}

export function nextMonth(month: MonthKey): MonthKey {
  return addMonths(month, 1)
}

/** 끝 월을 포함해 n개월(오름차순) */
export function lastNMonths(endMonth: MonthKey, n: number): MonthKey[] {
  const out: MonthKey[] = []
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(endMonth, -i))
  return out
}

export function monthRange(month: MonthKey): { start: DateKey; end: DateKey } {
  return { start: `${month}-01`, end: `${month}-${pad2(daysInMonth(month))}` }
}

/** 월에 없는 날짜(예: 2월 31일)는 말일로 보정 */
export function dateInMonth(month: MonthKey, day: number): DateKey {
  const d = Math.min(Math.max(1, Math.trunc(day)), daysInMonth(month))
  return `${month}-${pad2(d)}`
}

export function compareMonth(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** '2026-09' -> '2026년 9월' */
export function formatMonthKo(month: MonthKey): string {
  return `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`
}

/** '2026-09' -> '9월' */
export function formatMonthShortKo(month: MonthKey): string {
  return `${Number(month.slice(5, 7))}월`
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-09-05' -> '9월 5일 (토)' */
export function formatDateKo(date: DateKey, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEKDAY_KO[new Date(y, m - 1, d).getDay()]
  return withYear ? `${y}년 ${m}월 ${d}일 (${wd})` : `${m}월 ${d}일 (${wd})`
}

/**
 * 다양한 표기의 날짜를 'YYYY-MM-DD'로 정규화. 실패 시 null.
 * 지원: 2026-09-05, 2026.09.05, 2026/09/05, 20260905, 2026-09-05 13:20:11, 26.09.05, 09/05/2026(불허)
 */
export function normalizeDate(input: string | number | Date | null | undefined): DateKey | null {
  if (input === null || input === undefined) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : dateKeyOf(input)
  if (typeof input === 'number') {
    // 엑셀 시리얼(1900 기준) 또는 epoch ms
    if (input > 20000 && input < 80000) {
      const epoch = Date.UTC(1899, 11, 30)
      const d = new Date(epoch + Math.round(input) * 86400000)
      return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
    }
    if (input > 1e11) return dateKeyOf(new Date(input))
    return null
  }
  const s = String(input).trim()
  if (!s) return null
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/)
  if (!m) {
    const short = s.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})(?!\d)/)
    if (short) m = [short[0], `20${short[1]}`, short[2], short[3]] as unknown as RegExpMatchArray
  }
  if (!m) return null
  const key = `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`
  return isDateKey(key) ? key : null
}
