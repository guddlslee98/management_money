import { describe, expect, it } from 'vitest'
import { fnv1a, hashRows, importHash } from './hash'

describe('import hash', () => {
  it('is deterministic and ignores spacing/case in payee', () => {
    const a = importHash({ date: '2026-09-01', amount: 4500, type: 'expense', payee: '스타벅스 강남' })
    const b = importHash({ date: '2026-09-01', amount: 4500, type: 'expense', payee: '스타벅스강남' })
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{8}$/)
    expect(importHash({ date: '2026-09-02', amount: 4500, type: 'expense', payee: '스타벅스강남' })).not.toBe(a)
    expect(fnv1a('')).toBe('811c9dc5')
  })

  it('distinguishes identical rows within one file by ordinal', () => {
    const rows = [
      { date: '2026-09-01', amount: 4500, type: 'expense', payee: '스타벅스' },
      { date: '2026-09-01', amount: 4500, type: 'expense', payee: '스타벅스' },
      { date: '2026-09-01', amount: 4500, type: 'expense', payee: '이디야' },
    ]
    const h = hashRows(rows)
    expect(new Set(h).size).toBe(3)
    // 같은 파일을 다시 가져오면 동일한 해시 집합
    expect(hashRows(rows)).toEqual(h)
  })
})
