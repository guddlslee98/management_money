/**
 * 도메인 타입. 금액은 항상 정수(원) 단위이며 음수를 허용하지 않는다.
 * 환불/반환은 isRefund 플래그로 표현한다.
 */

export type TxType = 'expense' | 'income' | 'transfer'
export type CategoryKind = 'expense' | 'income'
export type AccountType = 'cash' | 'bank' | 'card' | 'savings' | 'investment' | 'other'
export type TxSource = 'manual' | 'import' | 'recurring'

export interface Transaction {
  id: string
  type: TxType
  /** YYYY-MM-DD (로컬 날짜, 시간대 무관) */
  date: string
  /** YYYY-MM — date에서 파생, 월별 조회 인덱스 */
  month: string
  /** 정수 원. 항상 0 이상 */
  amount: number
  /** expense/income 전용. null이면 미분류 */
  categoryId: string | null
  /** 출금/입금 계좌 (transfer는 출금 계좌) */
  accountId: string | null
  /** transfer 전용: 입금 계좌 */
  toAccountId: string | null
  /** 거래처/가맹점 */
  payee: string
  memo: string
  /** expense 환불 또는 income 반환: 집계 시 차감 */
  isRefund: boolean
  source: TxSource
  /** 파일 가져오기 중복 감지용 해시 */
  importHash: string | null
  recurringRuleId: string | null
  createdAt: number
  updatedAt: number
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  emoji: string
  /** hex color, 예: #ef4444 */
  color: string
  /** null이면 대분류, 값이 있으면 그 대분류의 소분류 */
  parentId: string | null
  sortOrder: number
  isArchived: boolean
}

export interface Account {
  id: string
  name: string
  type: AccountType
  /** 앱 사용 시작 시점의 잔액(정수 원). 카드는 보통 0 */
  initialBalance: number
  color: string
  sortOrder: number
  isArchived: boolean
}

export interface Budget {
  id: string
  /** 대분류 카테고리 id */
  categoryId: string
  /** 'YYYY-MM' 특정 월 예산, '*' 는 기본(매월) 예산 */
  month: string
  amount: number
}

export interface RecurringRule {
  id: string
  type: TxType
  amount: number
  categoryId: string | null
  accountId: string | null
  toAccountId: string | null
  payee: string
  memo: string
  /** 1~31. 해당 월에 없는 날짜면 말일로 보정 */
  dayOfMonth: number
  /** 'YYYY-MM' 부터 */
  startMonth: string
  /** 'YYYY-MM' 까지(포함). null이면 무기한 */
  endMonth: string | null
  isActive: boolean
  createdAt: number
  updatedAt: number
}

export interface ClassifyRule {
  id: string
  /** 거래처/메모에 포함되는 키워드(대소문자 무시). 여러 키워드는 '|'로 구분 */
  pattern: string
  categoryId: string
  source: 'default' | 'user'
  /** 클수록 우선 */
  priority: number
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

export const UNCATEGORIZED_ID = '__uncategorized__'

/** 리포트에서 categoryId가 없는 거래를 묶는 가상 카테고리 */
export const UNCATEGORIZED: Pick<Category, 'id' | 'name' | 'emoji' | 'color'> = { id: UNCATEGORIZED_ID, name: '미분류', emoji: '❔', color: '#9ca3af' }

/** 거래의 집계 방향을 반영한 금액: 환불이면 음수 */
export function effectiveAmount(tx: Pick<Transaction, 'amount' | 'isRefund'>): number {
  return tx.isRefund ? -tx.amount : tx.amount
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // 아주 오래된 환경용 폴백
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
