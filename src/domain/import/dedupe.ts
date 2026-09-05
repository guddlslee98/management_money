import { hashRows } from './hash'
import type { ParsedRow } from './profiles'

/** 행 목록의 importHash (같은 파일 안의 동일 행은 순번으로 구분) */
export function computeHashes(rows: ParsedRow[]): string[] {
  return hashRows(rows.map((r) => ({ date: r.date, amount: r.amount, type: r.type, payee: r.payee })))
}

/** 이미 저장된 해시와 겹치는 행 표시 */
export function markDuplicates(hashes: string[], existing: Set<string>): boolean[] {
  return hashes.map((h) => existing.has(h))
}
