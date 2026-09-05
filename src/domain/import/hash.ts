import { normalizeText } from '../classify'

/** FNV-1a 32bit → 8자리 hex */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export interface HashInput {
  date: string
  amount: number
  type: string
  payee: string
  /** 같은 파일 안에서 완전히 동일한 행이 여러 개일 때의 순번(0부터) */
  ordinal?: number
}

/**
 * 가져오기 중복 감지 키. 날짜+금액+유형+정규화된 가맹점(+동일행 순번).
 * 같은 파일을 다시 가져오면 모두 중복으로 걸리고, 같은 날 같은 금액의 정당한 거래 2건은 순번으로 구분된다.
 */
export function importHash(i: HashInput): string {
  return fnv1a(`${i.date}|${i.amount}|${i.type}|${normalizeText(i.payee)}|${i.ordinal ?? 0}`)
}

/** 행 목록에 순번을 매겨 해시를 만든다 */
export function hashRows<T extends Omit<HashInput, 'ordinal'>>(rows: T[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((r) => {
    const key = `${r.date}|${r.amount}|${r.type}|${normalizeText(r.payee)}`
    const ordinal = seen.get(key) ?? 0
    seen.set(key, ordinal + 1)
    return importHash({ ...r, ordinal })
  })
}
