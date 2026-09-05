import { describe, expect, it } from 'vitest'
import { ValidationError, type BackupData } from '../../db/repo'
import type { Account, Category, Transaction } from '../../db/types'
import { backupFileName, csvEscape, csvFileName, CSV_HEADERS, parseBackupJson, summarizeBackup, toBackupJson, transactionsToCsv, UTF8_BOM } from './serialize'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't1',
  type: 'expense',
  date: '2026-09-03',
  month: '2026-09',
  amount: 4500,
  categoryId: 'food.cafe',
  accountId: 'acc.card',
  toAccountId: null,
  payee: '스타벅스',
  memo: '',
  isRefund: false,
  source: 'manual',
  importHash: null,
  recurringRuleId: null,
    recurringMonth: null,
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
]
const accs: Account[] = [
  { id: 'acc.card', name: '신용카드', type: 'card', initialBalance: 0, color: '#000', sortOrder: 0, isArchived: false },
  { id: 'acc.bank', name: '은행', type: 'bank', initialBalance: 0, color: '#000', sortOrder: 1, isArchived: false },
]

const backup = (over: Partial<BackupData> = {}): BackupData => ({
  app: 'management-money',
  version: 1,
  exportedAt: '2026-09-05T03:00:00.000Z',
  transactions: [tx({})],
  categories: cats,
  accounts: accs,
  budgets: [{ id: 'b1', categoryId: 'food', month: '*', amount: 300_000 }],
  recurringRules: [],
  classifyRules: [],
  settings: [
    { key: 'theme', value: 'dark' },
    { key: 'backup.dirHandle', value: {} },
    { key: 'backup.lastAutoAt', value: 'x' },
  ],
  ...over,
})

describe('toBackupJson / parseBackupJson', () => {
  it('round-trips and drops device-bound backup.* settings', () => {
    const json = toBackupJson(backup())
    expect(json.startsWith('{\n  "app": "management-money"')).toBe(true)
    const parsed = parseBackupJson(json)
    expect(parsed.transactions).toEqual([tx({})])
    expect(parsed.categories).toEqual(cats)
    expect(parsed.budgets[0].amount).toBe(300_000)
    expect(parsed.settings).toEqual([{ key: 'theme', value: 'dark' }])
    expect(parsed.exportedAt).toBe('2026-09-05T03:00:00.000Z')
  })

  it('accepts missing optional tables', () => {
    const parsed = parseBackupJson(JSON.stringify({ app: 'management-money', version: 1, transactions: [] }))
    expect(parsed.categories).toEqual([])
    expect(parsed.settings).toEqual([])
  })

  it('rejects invalid input with Korean ValidationError messages', () => {
    expect(() => parseBackupJson('{not json')).toThrow(ValidationError)
    expect(() => parseBackupJson('{not json')).toThrow('JSON')
    expect(() => parseBackupJson('[]')).toThrow('형식')
    expect(() => parseBackupJson(JSON.stringify({ app: 'other', version: 1, transactions: [] }))).toThrow('이 앱')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', transactions: [] }))).toThrow('버전')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 99, transactions: [] }))).toThrow('지원하지 않는 백업 버전')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 1 }))).toThrow('거래 목록이 없습니다')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 1, transactions: {} }))).toThrow('거래 목록의 형식')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 1, transactions: [{ id: 't', type: 'expense', date: '2026-13-01', amount: 1 }] }))).toThrow('날짜')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 1, transactions: [{ id: 't', type: 'expense', date: '2026-09-01', amount: -1 }] }))).toThrow('금액')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 1, transactions: [{ id: 't', type: 'gift', date: '2026-09-01', amount: 1 }] }))).toThrow('유형')
    expect(() => parseBackupJson(JSON.stringify({ app: 'management-money', version: 1, transactions: [], categories: [{ name: 'no id' }] }))).toThrow('카테고리 1번째')
  })
})

describe('transactionsToCsv', () => {
  it('writes BOM, Korean headers, CRLF and resolves names', () => {
    const csv = transactionsToCsv([tx({})], cats, accs)
    expect(csv.startsWith(UTF8_BOM)).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe(CSV_HEADERS.join(','))
    expect(lines[1]).toBe('2026-09-03,지출,4500,,식비,카페,신용카드,,스타벅스,,직접 입력')
    expect(lines[2]).toBe('')
  })

  it('escapes commas, quotes and newlines; marks refunds; handles transfer and uncategorized', () => {
    const rows = [
      tx({ id: 'a', date: '2026-09-10', memo: 'a,b "c"\nd', isRefund: true, categoryId: null, source: 'import' }),
      tx({ id: 'b', date: '2026-09-01', type: 'transfer', categoryId: null, accountId: 'acc.bank', toAccountId: 'acc.card', payee: '카드대금', amount: 100000, source: 'recurring' }),
    ]
    const lines = transactionsToCsv(rows, cats, accs).slice(1).split('\r\n')
    // 날짜 오름차순
    expect(lines[1]).toBe('2026-09-01,이체,100000,,,,은행,신용카드,카드대금,,반복 거래')
    expect(lines[2]).toBe('2026-09-10,지출,4500,Y,미분류,,신용카드,,스타벅스,"a,b ""c""\nd",가져오기')
  })

  it('csvEscape only quotes when needed', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape(12)).toBe('12')
    expect(csvEscape('x"y')).toBe('"x""y"')
  })
})

describe('file names and summary', () => {
  it('builds dated file names', () => {
    expect(backupFileName(new Date(2026, 8, 5))).toBe('management-money-backup-2026-09-05.json')
    expect(backupFileName('2026-01-31')).toBe('management-money-backup-2026-01-31.json')
    expect(csvFileName('2026-09-05')).toBe('management-money-transactions-2026-09-05.csv')
  })

  it('summarizes counts and date range', () => {
    const s = summarizeBackup(backup({ transactions: [tx({ date: '2026-09-03' }), tx({ id: 't2', date: '2026-07-01' })] }))
    expect(s.counts).toEqual({ transactions: 2, categories: 2, accounts: 2, budgets: 1, recurringRules: 0, classifyRules: 0, settings: 3 })
    expect(s.total).toBe(10)
    expect(s.dateRange).toEqual({ from: '2026-07-01', to: '2026-09-03' })
    expect(summarizeBackup(backup({ transactions: [] })).dateRange).toBeNull()
  })
})
