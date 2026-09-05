/**
 * 백업 직렬화/역직렬화 (순수 함수, 부수효과 없음).
 * JSON 백업은 db/repo.ts의 BackupData 그대로이며, 기기 종속 설정(backup.*)만 제외한다.
 */
import { ValidationError, type BackupData } from '../../db/repo'
import { UNCATEGORIZED, type Account, type Category, type Transaction, type TxSource, type TxType } from '../../db/types'
import { dateKeyOf, isDateKey, type DateKey } from '../../domain/dates'

export const BACKUP_APP = 'management-money' as const
/** 이 앱이 읽을 수 있는 최대 백업 버전 */
export const BACKUP_VERSION = 1

export type BackupTable = 'transactions' | 'categories' | 'accounts' | 'budgets' | 'recurringRules' | 'classifyRules' | 'settings'
export const BACKUP_TABLES: BackupTable[] = ['transactions', 'categories', 'accounts', 'budgets', 'recurringRules', 'classifyRules', 'settings']
export const TABLE_LABELS: Record<BackupTable, string> = {
  transactions: '거래',
  categories: '카테고리',
  accounts: '계좌',
  budgets: '예산',
  recurringRules: '반복 거래',
  classifyRules: '분류 규칙',
  settings: '설정',
}

/** 폴더 핸들·마지막 백업 시각 등은 기기에 묶인 값이라 백업에 넣지 않는다 */
export function isPortableSetting(key: string): boolean {
  return !key.startsWith('backup.')
}

/** 보기 좋은(들여쓰기) JSON 문자열 */
export function toBackupJson(data: BackupData): string {
  const portable: BackupData = {
    ...data,
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    settings: (data.settings ?? []).filter((s) => isPortableSetting(s.key)),
  }
  return JSON.stringify(portable, null, 2)
}

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const TX_TYPES: TxType[] = ['expense', 'income', 'transfer']

function readRows(raw: Rec, table: BackupTable, required: boolean, idField: 'id' | 'key'): Rec[] {
  const v = raw[table]
  if (v === undefined || v === null) {
    if (required) throw new ValidationError(`백업에 ${TABLE_LABELS[table]} 목록이 없습니다`)
    return []
  }
  if (!Array.isArray(v)) throw new ValidationError(`${TABLE_LABELS[table]} 목록의 형식이 올바르지 않습니다`)
  v.forEach((row, i) => {
    if (!isRec(row) || typeof row[idField] !== 'string' || !row[idField]) throw new ValidationError(`${TABLE_LABELS[table]} ${i + 1}번째 항목이 올바르지 않습니다`)
  })
  return v as Rec[]
}

function validateTxRow(row: Rec, i: number): void {
  const at = `거래 ${i + 1}번째 항목`
  if (!TX_TYPES.includes(row.type as TxType)) throw new ValidationError(`${at}: 유형이 올바르지 않습니다`)
  if (typeof row.date !== 'string' || !isDateKey(row.date)) throw new ValidationError(`${at}: 날짜 형식이 올바르지 않습니다`)
  if (typeof row.amount !== 'number' || !Number.isInteger(row.amount) || row.amount < 0) throw new ValidationError(`${at}: 금액은 0 이상의 정수여야 합니다`)
}

/** 백업 JSON 텍스트를 검증해 BackupData로. 실패 시 한국어 메시지의 ValidationError */
export function parseBackupJson(text: string): BackupData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ValidationError('백업 파일을 읽을 수 없습니다 (JSON 형식이 아닙니다)')
  }
  if (!isRec(raw)) throw new ValidationError('백업 파일 형식이 아닙니다')
  if (raw.app !== BACKUP_APP) throw new ValidationError('이 앱(가계부)의 백업 파일이 아닙니다')
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new ValidationError('백업 버전 정보가 없거나 올바르지 않습니다')
  if (version > BACKUP_VERSION) throw new ValidationError(`지원하지 않는 백업 버전입니다 (v${version}). 앱을 최신 버전으로 업데이트한 뒤 다시 시도하세요`)

  const transactions = readRows(raw, 'transactions', true, 'id')
  transactions.forEach(validateTxRow)
  return {
    app: BACKUP_APP,
    version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    transactions: transactions as unknown as Transaction[],
    categories: readRows(raw, 'categories', false, 'id') as unknown as BackupData['categories'],
    accounts: readRows(raw, 'accounts', false, 'id') as unknown as BackupData['accounts'],
    budgets: readRows(raw, 'budgets', false, 'id') as unknown as BackupData['budgets'],
    recurringRules: readRows(raw, 'recurringRules', false, 'id') as unknown as BackupData['recurringRules'],
    classifyRules: readRows(raw, 'classifyRules', false, 'id') as unknown as BackupData['classifyRules'],
    settings: (readRows(raw, 'settings', false, 'key') as unknown as BackupData['settings']).filter((s) => isPortableSetting(s.key)),
  }
}

export interface BackupSummary {
  exportedAt: string
  counts: Record<BackupTable, number>
  total: number
  /** 거래가 없으면 null */
  dateRange: { from: DateKey; to: DateKey } | null
}

export function summarizeBackup(data: BackupData): BackupSummary {
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, (data[t] ?? []).length])) as Record<BackupTable, number>
  let from: DateKey | null = null
  let to: DateKey | null = null
  for (const t of data.transactions ?? []) {
    if (from === null || t.date < from) from = t.date
    if (to === null || t.date > to) to = t.date
  }
  return {
    exportedAt: data.exportedAt ?? '',
    counts,
    total: BACKUP_TABLES.reduce((s, t) => s + counts[t], 0),
    dateRange: from !== null && to !== null ? { from, to } : null,
  }
}

// ---------- 파일 이름 ----------

const FILE_PREFIX = 'management-money-backup'
export const DATED_BACKUP_RE = /^management-money-backup-(\d{4}-\d{2}-\d{2})\.json$/

function keyOf(date: Date | DateKey): DateKey {
  return typeof date === 'string' ? date : dateKeyOf(date)
}

/** management-money-backup-YYYY-MM-DD.json */
export function backupFileName(date: Date | DateKey = new Date()): string {
  return `${FILE_PREFIX}-${keyOf(date)}.json`
}

/** management-money-transactions-YYYY-MM-DD.csv */
export function csvFileName(date: Date | DateKey = new Date()): string {
  return `management-money-transactions-${keyOf(date)}.csv`
}

// ---------- CSV ----------

export const CSV_HEADERS = ['날짜', '유형', '금액', '환불', '대분류', '소분류', '계좌', '입금계좌', '거래처', '메모', '출처'] as const
const TYPE_LABEL: Record<TxType, string> = { expense: '지출', income: '수입', transfer: '이체' }
const SOURCE_LABEL: Record<TxSource, string> = { manual: '직접 입력', import: '가져오기', recurring: '반복 거래' }
/** 엑셀이 UTF-8로 인식하도록 붙이는 BOM */
export const UTF8_BOM = '﻿'

/** RFC 4180: 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 두 번 */
export function csvEscape(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function categoryNames(tx: Transaction, cats: Map<string, Category>): [string, string] {
  if (tx.type === 'transfer') return ['', '']
  const c = tx.categoryId ? cats.get(tx.categoryId) : undefined
  if (!c) return [UNCATEGORIZED.name, '']
  if (c.parentId) return [cats.get(c.parentId)?.name ?? '', c.name]
  return [c.name, '']
}

/** 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM + CRLF. 날짜 오름차순 */
export function transactionsToCsv(txs: Transaction[], categories: Category[], accounts: Account[]): string {
  const cats = new Map(categories.map((c) => [c.id, c]))
  const accs = new Map(accounts.map((a) => [a.id, a]))
  const accName = (id: string | null) => (id ? (accs.get(id)?.name ?? '') : '')
  const rows = [...txs].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
  const lines: string[] = [CSV_HEADERS.join(',')]
  for (const t of rows) {
    const [major, minor] = categoryNames(t, cats)
    const cells: Array<string | number> = [t.date, TYPE_LABEL[t.type], t.amount, t.isRefund ? 'Y' : '', major, minor, accName(t.accountId), accName(t.toAccountId), t.payee, t.memo, SOURCE_LABEL[t.source] ?? t.source]
    lines.push(cells.map(csvEscape).join(','))
  }
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`
}
