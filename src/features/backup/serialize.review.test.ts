import { describe, expect, it } from 'vitest'
import { csvEscape, parseBackupJson, toBackupJson } from './serialize'

describe('review regressions: serialize', () => {
  it('neutralises formula-leading CSV cells', () => {
    expect(csvEscape('=1+1')).toBe('"\'=1+1"')
    expect(csvEscape('-환불')).toBe('"\'-환불"')
    expect(csvEscape('@cmd')).toBe('"\'@cmd"')
    expect(csvEscape('스타벅스')).toBe('스타벅스')
    expect(csvEscape(-5000)).toBe('-5000') // 숫자는 그대로
  })

  it('normalises transaction rows missing optional fields and recomputes month', () => {
    const json = JSON.stringify({
      app: 'management-money',
      version: 1,
      exportedAt: '2026-09-05T00:00:00.000Z',
      transactions: [{ id: 't1', type: 'expense', date: '2026-09-03', amount: 4500, month: '1999-01' }],
    })
    const data = parseBackupJson(json)
    expect(data.transactions[0]).toMatchObject({ id: 't1', month: '2026-09', payee: '', memo: '', isRefund: false, source: 'manual', categoryId: null, accountId: null, toAccountId: null, recurringRuleId: null, recurringMonth: null })
    expect(typeof data.transactions[0].createdAt).toBe('number')
    // 다시 직렬화해도 완전한 행이 유지된다
    expect(parseBackupJson(toBackupJson(data)).transactions[0].month).toBe('2026-09')
  })

  it('rejects transfers without both accounts', () => {
    const json = JSON.stringify({ app: 'management-money', version: 1, transactions: [{ id: 't1', type: 'transfer', date: '2026-09-03', amount: 100, accountId: 'a', toAccountId: 'a' }] })
    expect(() => parseBackupJson(json)).toThrow(/거래 1번째/)
  })
})
