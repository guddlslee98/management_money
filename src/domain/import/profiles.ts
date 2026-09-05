/**
 * 가져오기 2단계: 헤더로 출처(프로필)를 추정하고, 열 매핑을 거래 행(ParsedRow)으로 바꾼다.
 * 열 매핑은 헤더 인덱스 기준. 검증 실패는 throw 대신 errors[]에 모은다.
 */
import type { TxType } from '../../db/types'
import { normalizeDate } from '../dates'
import { parseAmount } from '../money'
import { normalizeHeader } from './headers'

export type ProfileHint = 'bank' | 'card' | 'ledger' | 'generic'
export type AmountMode = 'single' | 'split'
export type ProfileId =
  | 'toss'
  | 'tossbank'
  | 'banksalad'
  | 'kb-bank'
  | 'shinhan-bank'
  | 'kakaobank'
  | 'shinhan-card'
  | 'samsung-card'
  | 'hyundai-card'
  | 'kb-card'
  | 'pyeonhan'
  | 'generic'

export interface ColumnMapping {
  date: number | null
  time: number | null
  payee: number | null
  memo: number | null
  /** 프로필이 덧붙이는 보조 메모 열(적요·거래구분 등). UI에서 편집하지 않음 */
  extraMemo: number[]
  amountMode: AmountMode
  /** 단일 금액 열 (부호 또는 유형 열로 방향 결정) */
  amount: number | null
  /** 출금/입금 분리 열 */
  outflow: number | null
  inflow: number | null
  /** 지출/수입/이체 값을 담은 열 */
  typeColumn: number | null
  expenseValues: string[]
  incomeValues: string[]
  transferValues: string[]
  /** 취소/거절 표시 열 → 환불 처리 */
  statusColumn: number | null
  cancelValues: string[]
  categoryMajor: number | null
  categoryMinor: number | null
  /** 단일 금액 열에서 음수=지출, 양수=수입 (은행). false면 카드 규칙(양수=지출) */
  negativeIsExpense: boolean
  /** 부호·유형 정보가 없을 때 지출로 간주 (카드 이용내역) */
  cardDefaultsToExpense: boolean
}

export interface ImportProfile {
  id: ProfileId
  name: string
  hint: ProfileHint
  /** 0~1. 헤더가 이 출처와 얼마나 맞는지 */
  score(headers: string[]): number
  mapping(headers: string[]): ColumnMapping
}

export interface ParsedRow {
  /** body 기준 인덱스 */
  rowIndex: number
  /** YYYY-MM-DD, 인식 실패 시 '' */
  date: string
  /** 0 이상 정수 */
  amount: number
  type: TxType
  /** 이 계좌 기준 돈의 방향 (transfer 방향 결정용) */
  flow: 'out' | 'in'
  isRefund: boolean
  payee: string
  memo: string
  rawCategory?: { major: string; minor: string }
  errors: string[]
}

/* ---------- 헤더 매칭 ---------- */

/** alias 앞에 '='가 붙으면 정확히 일치, 아니면 포함. aliases 순서가 우선순위 */
export function findColumn(headers: string[], aliases: string[], exclude: Array<number | null> = []): number | null {
  const norm = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const exact = alias.startsWith('=')
    const key = normalizeHeader(exact ? alias.slice(1) : alias)
    if (!key) continue
    for (let i = 0; i < norm.length; i++) {
      if (exclude.includes(i)) continue
      if (exact ? norm[i] === key : norm[i].includes(key)) return i
    }
  }
  return null
}

interface Token {
  any: string[]
  w: number
}

function scoreTokens(headers: string[], tokens: Token[]): number {
  let total = 0
  let hit = 0
  for (const t of tokens) {
    total += t.w
    if (findColumn(headers, t.any) !== null) hit += t.w
  }
  return total ? hit / total : 0
}

const DATE_ALIASES = [
  '거래일시',
  '이용일시',
  '승인일시',
  '거래일자',
  '이용일자',
  '승인일자',
  '사용일자',
  '거래일',
  '이용일',
  '승인일',
  '사용일',
  '결제일시',
  '결제일',
  '=날짜',
  '날짜',
  '일시',
  '일자',
  'date',
]
const TIME_ALIASES = ['거래시간', '이용시간', '승인시각', '승인시간', '이용시각', '=시간', '시각', 'time']
const OUT_ALIASES = ['찾으신금액', '출금액', '출금금액', '지급(원)', '=출금', '출금(원)', '출금', 'withdraw', 'debit']
const IN_ALIASES = ['맡기신금액', '입금액', '입금금액', '=입금', '입금(원)', '입금', 'deposit', 'credit']
const AMOUNT_ALIASES = ['국내이용금액', '승인금액', '이용금액', '거래금액', '결제금액', '사용금액', '=금액', '금액', 'amount']
const PAYEE_ALIASES = [
  '가맹점명',
  '이용가맹점',
  '이용하신곳',
  '사용처',
  '가맹점',
  '상호',
  '거래처',
  '보낸분/받는분',
  '보낸분',
  '받는분',
  '거래기록사항',
  '기재내용',
  '상대',
  '=내용',
  '거래내용',
  '내용',
  '내역',
  '적요',
  'merchant',
  'payee',
  'description',
  'name',
]
const MEMO_ALIASES = ['=메모', '송금메모', '비고', '적요', '거래구분', '결제방법', '이용구분', '할부', 'note', 'memo']
const TYPE_ALIASES = ['=타입', '=구분', '=거래유형', '=수입/지출', '=수입지출', '=유형', '=입출구분', '=입/출금', '=입출금구분', '=type']
const STATUS_ALIASES = ['취소여부', '취소상태', '구분/상태', '취소구분', '승인구분', '=상태', '매입구분']
const BALANCE_ALIASES = ['잔액', 'balance']

const DEFAULT_EXPENSE = ['지출', '출금', '결제', '승인']
const DEFAULT_INCOME = ['수입', '입금']
const DEFAULT_TRANSFER = ['이체']
const DEFAULT_CANCEL = ['취소', '거절', '무효']

export function emptyMapping(): ColumnMapping {
  return {
    date: null,
    time: null,
    payee: null,
    memo: null,
    extraMemo: [],
    amountMode: 'single',
    amount: null,
    outflow: null,
    inflow: null,
    typeColumn: null,
    expenseValues: DEFAULT_EXPENSE,
    incomeValues: DEFAULT_INCOME,
    transferValues: DEFAULT_TRANSFER,
    statusColumn: null,
    cancelValues: DEFAULT_CANCEL,
    categoryMajor: null,
    categoryMinor: null,
    negativeIsExpense: true,
    cardDefaultsToExpense: false,
  }
}

/** 헤더 이름만 보고 최대한 추측하는 범용 매핑 */
export function guessMapping(headers: string[]): ColumnMapping {
  const m = emptyMapping()
  const balance = findColumn(headers, BALANCE_ALIASES)
  m.date = findColumn(headers, DATE_ALIASES)
  m.time = findColumn(headers, TIME_ALIASES, [m.date])
  m.outflow = findColumn(headers, OUT_ALIASES, [balance])
  m.inflow = findColumn(headers, IN_ALIASES, [balance, m.outflow])
  m.amount = findColumn(headers, AMOUNT_ALIASES, [balance, m.outflow, m.inflow])
  if (m.outflow !== null && m.inflow !== null) {
    m.amountMode = 'split'
    m.amount = null
  } else {
    m.amountMode = 'single'
    if (m.amount === null) m.amount = m.outflow ?? m.inflow
    if (m.amount !== null && m.amount === m.outflow) {
      m.negativeIsExpense = false
      m.cardDefaultsToExpense = true
    }
    m.outflow = null
    m.inflow = null
  }
  m.payee = findColumn(headers, PAYEE_ALIASES, [m.date, m.time, m.amount, m.outflow, m.inflow, balance])
  m.memo = findColumn(headers, MEMO_ALIASES, [m.payee, m.date, m.time, m.amount, m.outflow, m.inflow, balance])
  m.typeColumn = findColumn(headers, TYPE_ALIASES)
  m.statusColumn = findColumn(headers, STATUS_ALIASES, [m.typeColumn, m.payee, m.memo])
  m.categoryMajor = findColumn(headers, ['대분류', '=분류', '카테고리', 'category'])
  m.categoryMinor = findColumn(headers, ['소분류', 'subcategory'])
  return m
}

const nums = (...xs: Array<number | null>): number[] => xs.filter((i): i is number => i !== null)

function cardMapping(headers: string[], over: Partial<ColumnMapping>): ColumnMapping {
  const m = guessMapping(headers)
  return {
    ...m,
    typeColumn: null,
    amountMode: 'single',
    outflow: null,
    inflow: null,
    negativeIsExpense: false,
    cardDefaultsToExpense: true,
    categoryMajor: null,
    categoryMinor: null,
    ...over,
  }
}

function bankSplitMapping(headers: string[], over: Partial<ColumnMapping>): ColumnMapping {
  const m = guessMapping(headers)
  return {
    ...m,
    amountMode: 'split',
    amount: null,
    typeColumn: null,
    negativeIsExpense: true,
    cardDefaultsToExpense: false,
    categoryMajor: null,
    categoryMinor: null,
    ...over,
  }
}

function ledgerMapping(headers: string[], over: Partial<ColumnMapping>): ColumnMapping {
  const m = guessMapping(headers)
  return {
    ...m,
    extraMemo: [],
    amountMode: 'single',
    outflow: null,
    inflow: null,
    statusColumn: null,
    negativeIsExpense: true,
    cardDefaultsToExpense: false,
    ...over,
  }
}

const col = (headers: string[], aliases: string[], exclude: Array<number | null> = []) => findColumn(headers, aliases, exclude)

/* ---------- 프로필 ---------- */

export const PROFILES: ImportProfile[] = [
  {
    id: 'banksalad',
    name: '뱅크샐러드 가계부 내역',
    hint: 'ledger',
    score: (h) =>
      scoreTokens(h, [
        { any: ['=날짜'], w: 1 },
        { any: ['=시간'], w: 0.5 },
        { any: ['=타입'], w: 1 },
        { any: ['=대분류'], w: 1 },
        { any: ['=소분류'], w: 1 },
        { any: ['=내용'], w: 0.5 },
        { any: ['=금액'], w: 1 },
        { any: ['=화폐'], w: 1 },
        { any: ['=결제수단'], w: 1.5 },
        { any: ['=메모'], w: 0.5 },
      ]),
    mapping: (h) =>
      ledgerMapping(h, {
        date: col(h, ['=날짜', ...DATE_ALIASES]),
        time: col(h, ['=시간']),
        payee: col(h, ['=내용', ...PAYEE_ALIASES]),
        memo: col(h, ['=메모']),
        amount: col(h, ['=금액', ...AMOUNT_ALIASES]),
        typeColumn: col(h, ['=타입', ...TYPE_ALIASES]),
        expenseValues: ['지출'],
        incomeValues: ['수입'],
        transferValues: ['이체'],
        categoryMajor: col(h, ['=대분류']),
        categoryMinor: col(h, ['=소분류']),
      }),
  },
  {
    id: 'pyeonhan',
    name: '편한가계부 내보내기',
    hint: 'ledger',
    score: (h) =>
      scoreTokens(h, [
        { any: ['=날짜'], w: 1 },
        { any: ['=자산', '=계좌'], w: 1.5 },
        { any: ['=분류', '=대분류', '=카테고리'], w: 1 },
        { any: ['=소분류'], w: 1 },
        { any: ['=내용'], w: 1 },
        { any: ['=금액'], w: 1 },
        { any: ['=수입/지출', '=수입지출', '=지출/수입', '=구분'], w: 1.5 },
        { any: ['=메모'], w: 0.5 },
        { any: ['=화폐', '=통화'], w: 0.5 },
      ]),
    mapping: (h) =>
      ledgerMapping(h, {
        date: col(h, ['=날짜', ...DATE_ALIASES]),
        payee: col(h, ['=내용', ...PAYEE_ALIASES]),
        memo: col(h, ['=메모', '=비고']),
        amount: col(h, ['=금액', ...AMOUNT_ALIASES]),
        typeColumn: col(h, ['=수입/지출', '=수입지출', '=지출/수입', '=구분', '=타입']),
        expenseValues: ['지출'],
        incomeValues: ['수입'],
        transferValues: ['이체'],
        categoryMajor: col(h, ['=분류', '=대분류', '=카테고리']),
        categoryMinor: col(h, ['=소분류']),
      }),
  },
  {
    id: 'tossbank',
    name: '토스뱅크 거래내역 (엑셀)',
    hint: 'bank',
    score: (h) =>
      scoreTokens(h, [
        { any: ['거래일시'], w: 1 },
        { any: ['=적요'], w: 1 },
        { any: ['거래유형'], w: 1.5 },
        { any: ['거래기관'], w: 1.5 },
        { any: ['계좌번호'], w: 0.5 },
        { any: ['거래금액'], w: 1 },
        { any: ['거래후잔액'], w: 1 },
        { any: ['=메모'], w: 0.5 },
      ]),
    mapping: (h) =>
      ledgerMapping(h, {
        date: col(h, ['거래일시', ...DATE_ALIASES]),
        payee: col(h, ['=적요', '거래기록사항', '보낸분', ...PAYEE_ALIASES]),
        memo: col(h, ['=메모']),
        extraMemo: nums(col(h, ['거래기관'])),
        amount: col(h, ['거래금액', ...AMOUNT_ALIASES], [col(h, BALANCE_ALIASES)]),
        typeColumn: col(h, ['거래유형']),
        expenseValues: ['출금'],
        incomeValues: ['입금'],
        transferValues: [],
        categoryMajor: null,
        categoryMinor: null,
      }),
  },
  {
    id: 'toss',
    name: '토스 거래내역 (CSV)',
    hint: 'bank',
    score: (h) =>
      scoreTokens(h, [
        { any: ['거래일시', '=날짜'], w: 1 },
        { any: ['=적요', '=내용'], w: 1 },
        { any: ['거래유형', '=구분'], w: 1 },
        { any: ['보낸분/받는분', '거래기록사항'], w: 1.5 },
        { any: ['거래금액', '=금액'], w: 1 },
        { any: ['거래후잔액', '=잔액'], w: 1 },
        { any: ['=순번', '=no'], w: 0.5 },
        { any: ['=메모'], w: 0.5 },
      ]),
    mapping: (h) =>
      ledgerMapping(h, {
        date: col(h, ['거래일시', ...DATE_ALIASES]),
        payee: col(h, ['보낸분/받는분', '거래기록사항', '=내용', ...PAYEE_ALIASES]),
        memo: col(h, ['=메모']),
        extraMemo: nums(col(h, ['=적요'])),
        amount: col(h, ['거래금액', ...AMOUNT_ALIASES], [col(h, BALANCE_ALIASES)]),
        typeColumn: col(h, ['거래유형', '=구분']),
        expenseValues: ['출금', '지출'],
        incomeValues: ['입금', '수입'],
        transferValues: [],
        categoryMajor: null,
        categoryMinor: null,
      }),
  },
  {
    id: 'kakaobank',
    name: '카카오뱅크 거래내역',
    hint: 'bank',
    score: (h) =>
      scoreTokens(h, [
        { any: ['거래일시'], w: 1 },
        { any: ['=구분'], w: 1 },
        { any: ['거래금액'], w: 1 },
        { any: ['거래후잔액'], w: 1.5 },
        { any: ['=거래구분'], w: 1.5 },
        { any: ['=내용'], w: 1 },
        { any: ['=메모'], w: 0.5 },
      ]),
    mapping: (h) =>
      ledgerMapping(h, {
        date: col(h, ['거래일시', ...DATE_ALIASES]),
        payee: col(h, ['=내용', '=적요', ...PAYEE_ALIASES]),
        memo: col(h, ['=메모']),
        extraMemo: nums(col(h, ['=거래구분'])),
        amount: col(h, ['거래금액', ...AMOUNT_ALIASES], [col(h, BALANCE_ALIASES)]),
        typeColumn: col(h, ['=구분', '거래유형']),
        expenseValues: ['출금'],
        incomeValues: ['입금'],
        transferValues: [],
        categoryMajor: null,
        categoryMinor: null,
      }),
  },
  {
    id: 'kb-bank',
    name: 'KB국민은행 거래내역',
    hint: 'bank',
    score: (h) =>
      scoreTokens(h, [
        { any: ['거래일시'], w: 1 },
        { any: ['=적요'], w: 1 },
        { any: ['기재내용', '보낸분/받는분', '내통장표시'], w: 1.5 },
        { any: ['찾으신금액', '출금액'], w: 1.5 },
        { any: ['맡기신금액', '입금액'], w: 1.5 },
        { any: ['잔액'], w: 0.5 },
        { any: ['거래점', '취급기관', '처리점'], w: 1 },
        { any: ['송금메모'], w: 0.5 },
      ]),
    mapping: (h) =>
      bankSplitMapping(h, {
        date: col(h, ['거래일시', ...DATE_ALIASES]),
        payee: col(h, ['보낸분/받는분', '기재내용', '내통장표시', ...PAYEE_ALIASES]),
        memo: col(h, ['=적요']),
        extraMemo: nums(col(h, ['송금메모'])),
        outflow: col(h, ['찾으신금액', '출금액', ...OUT_ALIASES]),
        inflow: col(h, ['맡기신금액', '입금액', ...IN_ALIASES]),
        statusColumn: null,
      }),
  },
  {
    id: 'shinhan-bank',
    name: '신한은행 거래내역',
    hint: 'bank',
    score: (h) =>
      scoreTokens(h, [
        { any: ['거래일자', '거래일시'], w: 1 },
        { any: ['거래시간'], w: 1 },
        { any: ['=적요'], w: 1 },
        { any: ['출금'], w: 1 },
        { any: ['입금'], w: 1 },
        { any: ['=내용'], w: 1 },
        { any: ['잔액'], w: 0.5 },
        { any: ['거래점', '거래기점'], w: 1 },
      ]),
    mapping: (h) =>
      bankSplitMapping(h, {
        date: col(h, ['거래일자', '거래일시', ...DATE_ALIASES]),
        time: col(h, ['거래시간']),
        payee: col(h, ['=내용', ...PAYEE_ALIASES]),
        memo: col(h, ['=적요']),
        outflow: col(h, ['출금액', '출금(원)', '=출금', ...OUT_ALIASES]),
        inflow: col(h, ['입금액', '입금(원)', '=입금', ...IN_ALIASES]),
        statusColumn: null,
      }),
  },
  {
    id: 'samsung-card',
    name: '삼성카드 이용내역',
    hint: 'card',
    score: (h) =>
      scoreTokens(h, [
        { any: ['카드번호'], w: 0.5 },
        { any: ['본인가족구분'], w: 1 },
        { any: ['승인일자'], w: 1.5 },
        { any: ['승인시각'], w: 1 },
        { any: ['가맹점명'], w: 1 },
        { any: ['승인금액'], w: 1.5 },
        { any: ['일시불할부구분'], w: 1 },
        { any: ['할부개월'], w: 0.5 },
        { any: ['승인번호'], w: 0.5 },
        { any: ['취소여부'], w: 1 },
      ]),
    mapping: (h) =>
      cardMapping(h, {
        date: col(h, ['승인일자', ...DATE_ALIASES]),
        time: col(h, ['승인시각', ...TIME_ALIASES]),
        payee: col(h, ['가맹점명', ...PAYEE_ALIASES]),
        memo: col(h, ['일시불할부구분', '이용구분', '할부']),
        extraMemo: nums(col(h, ['할부개월'])),
        amount: col(h, ['승인금액', ...AMOUNT_ALIASES]),
        statusColumn: col(h, ['취소여부', '취소구분', ...STATUS_ALIASES]),
        cancelValues: ['Y', '취소'],
      }),
  },
  {
    id: 'shinhan-card',
    name: '신한카드 이용내역',
    hint: 'card',
    score: (h) =>
      scoreTokens(h, [
        { any: ['=거래일', '이용일자'], w: 1 },
        { any: ['=이용카드'], w: 1 },
        { any: ['가맹점명', '이용가맹점'], w: 1 },
        { any: ['=금액', '=이용금액'], w: 1 },
        { any: ['=이용구분', '할부'], w: 0.5 },
        { any: ['승인번호'], w: 0.5 },
        { any: ['매입구분'], w: 1 },
        { any: ['취소상태', '구분/상태'], w: 1.5 },
      ]),
    mapping: (h) =>
      cardMapping(h, {
        date: col(h, ['=거래일', '이용일자', ...DATE_ALIASES]),
        payee: col(h, ['가맹점명', '이용가맹점', ...PAYEE_ALIASES]),
        memo: col(h, ['=이용구분', '할부기간']),
        extraMemo: nums(col(h, ['=이용카드'])),
        amount: col(h, ['=금액', '=이용금액', ...AMOUNT_ALIASES]),
        statusColumn: col(h, ['취소상태', '구분/상태', '매입구분', ...STATUS_ALIASES]),
        cancelValues: ['취소'],
      }),
  },
  {
    id: 'hyundai-card',
    name: '현대카드 이용내역',
    hint: 'card',
    score: (h) =>
      scoreTokens(h, [
        { any: ['이용일', '승인일'], w: 1 },
        { any: ['카드번호'], w: 0.5 },
        { any: ['가맹점명', '이용하신곳'], w: 1 },
        { any: ['이용금액', '승인금액'], w: 1 },
        { any: ['부가세'], w: 1.5 },
        { any: ['=관계'], w: 1 },
        { any: ['=할부'], w: 0.5 },
        { any: ['=상태'], w: 0.5 },
      ]),
    mapping: (h) =>
      cardMapping(h, {
        date: col(h, ['이용일', '승인일', ...DATE_ALIASES]),
        payee: col(h, ['가맹점명', '이용하신곳', ...PAYEE_ALIASES]),
        memo: col(h, ['=할부', '이용구분']),
        amount: col(h, ['이용금액', '승인금액', ...AMOUNT_ALIASES]),
        statusColumn: col(h, ['=상태', ...STATUS_ALIASES]),
        cancelValues: ['취소'],
      }),
  },
  {
    id: 'kb-card',
    name: 'KB국민카드 이용내역',
    hint: 'card',
    score: (h) =>
      scoreTokens(h, [
        { any: ['이용일'], w: 1 },
        { any: ['이용시간'], w: 1 },
        { any: ['이용카드명', '이용카드'], w: 1 },
        { any: ['이용하신곳'], w: 1.5 },
        { any: ['국내이용금액', '이용금액'], w: 1 },
        { any: ['결제방법'], w: 1 },
        { any: ['승인번호'], w: 0.5 },
        { any: ['=상태'], w: 0.5 },
        { any: ['해외이용금액'], w: 0.5 },
      ]),
    mapping: (h) =>
      cardMapping(h, {
        date: col(h, ['이용일', ...DATE_ALIASES]),
        time: col(h, ['이용시간', ...TIME_ALIASES]),
        payee: col(h, ['이용하신곳', '가맹점', ...PAYEE_ALIASES]),
        memo: col(h, ['결제방법', '이용구분']),
        extraMemo: nums(col(h, ['이용카드명'])),
        amount: col(h, ['국내이용금액', '이용금액', ...AMOUNT_ALIASES]),
        statusColumn: col(h, ['=상태', ...STATUS_ALIASES]),
        cancelValues: ['취소'],
      }),
  },
  {
    id: 'generic',
    name: '일반 (열 직접 지정)',
    hint: 'generic',
    score: () => 0,
    mapping: guessMapping,
  },
]

export const GENERIC_PROFILE = PROFILES[PROFILES.length - 1]

export function getProfile(id: string): ImportProfile {
  return PROFILES.find((p) => p.id === id) ?? GENERIC_PROFILE
}

export interface Detection {
  profile: ImportProfile
  /** 0~1 */
  confidence: number
}

/** 최고 점수 프로필. 동점이거나 점수가 낮으면 generic */
export function detectProfile(headers: string[], threshold = 0.55): Detection {
  let best: ImportProfile | null = null
  let bestScore = 0
  let tie = false
  for (const p of PROFILES) {
    if (p.id === 'generic') continue
    const s = p.score(headers)
    if (s > bestScore + 1e-9) {
      best = p
      bestScore = s
      tie = false
    } else if (best && Math.abs(s - bestScore) < 1e-9 && s > 0) {
      tie = true
    }
  }
  if (!best || tie || bestScore < threshold) return { profile: GENERIC_PROFILE, confidence: bestScore }
  return { profile: best, confidence: bestScore }
}

/* ---------- 행 변환 ---------- */

const normValue = (v: string) => v.toLowerCase().replace(/\s/g, '')

/** 한 글자 값(Y/N)은 정확히, 그 외는 포함 비교 */
export function matchesAny(value: string, list: string[]): boolean {
  const v = normValue(value)
  if (!v) return false
  return list.some((item) => {
    const k = normValue(item)
    if (!k) return false
    return k.length <= 1 ? v === k : v.includes(k)
  })
}

/** '2025년 1월 2일', '[2026-01-02 12:00]', 엑셀 일련번호 문자열도 허용 */
export function parseDateCell(raw: string): string | null {
  const s = raw
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/, '$1-$2-$3')
    .trim()
  if (!s) return null
  if (/^\d{5}(\.\d+)?$/.test(s)) return normalizeDate(Number(s))
  return normalizeDate(s)
}

export interface ApplyOptions {
  /** 거래처/메모에 포함되면 이체로 간주 (보수적으로 카드대금만) */
  transferKeywords?: string[]
}

const SUMMARY_ROW = /합계|총계|소계/

export function applyMapping(body: string[][], m: ColumnMapping, opts: ApplyOptions = {}): ParsedRow[] {
  const transferKeywords = opts.transferKeywords ?? ['카드대금']
  const get = (row: string[], idx: number | null): string => (idx === null || idx < 0 ? '' : String(row[idx] ?? '').trim())
  const out: ParsedRow[] = []

  body.forEach((row, rowIndex) => {
    if (!row.some((c) => String(c ?? '').trim() !== '')) return
    const errors: string[] = []
    const dateRaw = get(row, m.date)
    const amountCells = m.amountMode === 'split' ? [get(row, m.outflow), get(row, m.inflow)] : [get(row, m.amount)]
    const hasAmount = amountCells.some((c) => c !== '')
    const date = parseDateCell(dateRaw)
    // 날짜가 없는 합계/총계 행, 날짜도 금액도 없는 행은 건너뜀
    if (!date && (SUMMARY_ROW.test(row.join(' ')) || (!dateRaw && !hasAmount))) return
    if (!date) errors.push(m.date === null ? '날짜 열이 지정되지 않음' : dateRaw ? `날짜 인식 불가: ${dateRaw}` : '날짜 없음')

    let amount = 0
    let signed: number | null = null
    let type: TxType | null = null
    let flow: 'out' | 'in' = 'out'
    let isRefund = false

    if (m.amountMode === 'split') {
      const o = parseAmount(amountCells[0])
      const i = parseAmount(amountCells[1])
      if (o !== null && o !== 0) {
        amount = Math.abs(o)
        type = 'expense'
        flow = 'out'
        if (o < 0) isRefund = true
      } else if (i !== null && i !== 0) {
        amount = Math.abs(i)
        type = 'income'
        flow = 'in'
        if (i < 0) isRefund = true
      } else if (m.outflow === null && m.inflow === null) errors.push('금액 열이 지정되지 않음')
      else errors.push(hasAmount ? '금액이 0원' : '금액 없음')
    } else {
      const raw = amountCells[0]
      signed = parseAmount(raw)
      if (m.amount === null) errors.push('금액 열이 지정되지 않음')
      else if (signed === null) errors.push(raw ? `금액 인식 불가: ${raw}` : '금액 없음')
      else if (signed === 0) errors.push('금액이 0원')
      amount = Math.abs(signed ?? 0)
    }

    const typeVal = get(row, m.typeColumn)
    let typeFromColumn: TxType | null = null
    if (typeVal) {
      if (matchesAny(typeVal, m.transferValues)) typeFromColumn = 'transfer'
      else if (matchesAny(typeVal, m.expenseValues)) typeFromColumn = 'expense'
      else if (matchesAny(typeVal, m.incomeValues)) typeFromColumn = 'income'
    }
    if (typeFromColumn) type = typeFromColumn

    if (type === null) {
      if (signed !== null && signed < 0) {
        if (m.negativeIsExpense) type = 'expense'
        else {
          type = m.cardDefaultsToExpense ? 'expense' : 'income'
          if (m.cardDefaultsToExpense) isRefund = true
        }
      } else if (signed !== null && signed > 0) {
        type = m.negativeIsExpense && !m.cardDefaultsToExpense ? 'income' : 'expense'
      } else type = 'expense'
    }

    const payeeRaw = get(row, m.payee)
    const memoParts = [get(row, m.memo), ...m.extraMemo.map((i) => get(row, i))].filter((s) => s !== '')
    const memo = memoParts.join(' · ')
    const payee = payeeRaw || memoParts[0] || typeVal || ''

    if (type !== 'transfer') {
      const hay = `${payee} ${memo} ${typeVal}`
      if (transferKeywords.some((k) => k && hay.includes(k))) type = 'transfer'
    }

    if (type === 'expense') flow = 'out'
    else if (type === 'income') flow = 'in'
    else if (m.amountMode === 'single') {
      if (typeFromColumn === null && signed !== null && signed !== 0) flow = signed < 0 ? 'out' : m.negativeIsExpense ? 'in' : 'out'
      else if (matchesAny(typeVal, m.incomeValues)) flow = 'in'
      else if (matchesAny(typeVal, m.expenseValues)) flow = 'out'
      else if (signed !== null && signed > 0 && m.negativeIsExpense) flow = 'in'
      else flow = 'out'
    }

    const status = get(row, m.statusColumn)
    if (status && matchesAny(status, m.cancelValues)) isRefund = true
    if (type === 'transfer') isRefund = false

    const major = get(row, m.categoryMajor)
    const minor = get(row, m.categoryMinor)
    const parsed: ParsedRow = { rowIndex, date: date ?? '', amount, type, flow, isRefund, payee, memo, errors }
    if (major || minor) parsed.rawCategory = { major, minor }
    out.push(parsed)
  })
  return out
}
