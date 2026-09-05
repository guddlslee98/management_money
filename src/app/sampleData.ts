import { repos, type NewTransaction, type Repos } from '../db/repo'
import type { Category, TxType } from '../db/types'
import { addMonths, currentMonthKey, dateInMonth, daysInMonth, todayKey } from '../domain/dates'

/** 결정적 난수 (mulberry32) — 같은 seed면 같은 샘플 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MINI_CATEGORIES: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.restaurant', kind: 'expense', name: '외식', emoji: '🍽️', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'food.delivery', kind: 'expense', name: '배달', emoji: '🛵', color: '#f97316', parentId: 'food', sortOrder: 1, isArchived: false },
  { id: 'cafe', kind: 'expense', name: '카페·간식', emoji: '☕', color: '#a16207', parentId: null, sortOrder: 1, isArchived: false },
  { id: 'mart', kind: 'expense', name: '마트·편의점', emoji: '🛒', color: '#84cc16', parentId: null, sortOrder: 2, isArchived: false },
  { id: 'transport', kind: 'expense', name: '교통', emoji: '🚌', color: '#0ea5e9', parentId: null, sortOrder: 3, isArchived: false },
  { id: 'housing', kind: 'expense', name: '주거·공과금', emoji: '🏠', color: '#3b82f6', parentId: null, sortOrder: 4, isArchived: false },
  { id: 'housing.rent', kind: 'expense', name: '월세', emoji: '🏠', color: '#3b82f6', parentId: 'housing', sortOrder: 0, isArchived: false },
  { id: 'housing.utility', kind: 'expense', name: '공과금', emoji: '💡', color: '#3b82f6', parentId: 'housing', sortOrder: 1, isArchived: false },
  { id: 'telecom', kind: 'expense', name: '통신', emoji: '📱', color: '#6366f1', parentId: null, sortOrder: 5, isArchived: false },
  { id: 'shopping', kind: 'expense', name: '쇼핑', emoji: '🛍️', color: '#ec4899', parentId: null, sortOrder: 6, isArchived: false },
  { id: 'culture', kind: 'expense', name: '문화·여가', emoji: '🎬', color: '#8b5cf6', parentId: null, sortOrder: 7, isArchived: false },
  { id: 'health', kind: 'expense', name: '의료·건강', emoji: '💊', color: '#14b8a6', parentId: null, sortOrder: 8, isArchived: false },
  { id: 'subscription', kind: 'expense', name: '구독', emoji: '🔁', color: '#ef4444', parentId: null, sortOrder: 9, isArchived: false },
  { id: 'income.salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'income.side', kind: 'income', name: '부수입', emoji: '💰', color: '#10b981', parentId: null, sortOrder: 1, isArchived: false },
  { id: 'income.allowance', kind: 'income', name: '용돈', emoji: '🎁', color: '#f59e0b', parentId: null, sortOrder: 2, isArchived: false },
]

interface Template {
  type: TxType
  amount: [number, number]
  payees: string[]
  /** 카테고리 이름 후보 (DB에서 이름으로 찾음) */
  category: string[]
  perMonth: [number, number]
  account: 'card' | 'bank' | 'cash'
}

const TEMPLATES: Template[] = [
  { type: 'expense', amount: [6000, 18000], payees: ['김밥천국', '한솥도시락', '본죽', '국밥집', '맥도날드'], category: ['외식', '식비'], perMonth: [10, 16], account: 'card' },
  { type: 'expense', amount: [15000, 32000], payees: ['배달의민족', '쿠팡이츠', '요기요'], category: ['배달', '식비'], perMonth: [4, 8], account: 'card' },
  { type: 'expense', amount: [3500, 7500], payees: ['스타벅스', '메가커피', '투썸플레이스', '컴포즈커피'], category: ['카페', '카페·간식', '식비'], perMonth: [8, 14], account: 'card' },
  { type: 'expense', amount: [2000, 12000], payees: ['GS25', 'CU', '세븐일레븐'], category: ['편의점', '마트·편의점', '편의점·마트', '식비'], perMonth: [6, 12], account: 'card' },
  { type: 'expense', amount: [30000, 90000], payees: ['이마트', '홈플러스', '마켓컬리'], category: ['마트', '마트·편의점', '편의점·마트', '식비'], perMonth: [2, 4], account: 'card' },
  { type: 'expense', amount: [1400, 4800], payees: ['지하철', '버스', '카카오T'], category: ['대중교통', '교통'], perMonth: [12, 20], account: 'card' },
  { type: 'expense', amount: [20000, 120000], payees: ['쿠팡', '무신사', '네이버페이', '올리브영'], category: ['온라인쇼핑', '쇼핑'], perMonth: [2, 5], account: 'card' },
  { type: 'expense', amount: [12000, 40000], payees: ['CGV', '교보문고', '스팀'], category: ['영화', '문화·여가', '문화/여가', '취미'], perMonth: [1, 3], account: 'card' },
  { type: 'expense', amount: [5000, 45000], payees: ['약국', '이비인후과', '치과'], category: ['병원', '의료·건강', '의료', '건강'], perMonth: [0, 2], account: 'card' },
  { type: 'expense', amount: [5000, 20000], payees: ['호프집', '편의점'], category: ['식비'], perMonth: [0, 3], account: 'cash' },
  { type: 'income', amount: [50000, 300000], payees: ['당근마켓', '프리랜스', '이자'], category: ['부수입', '중고거래', '이자·배당', '기타수입'], perMonth: [0, 2], account: 'bank' },
]

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)]
}
function between(r: () => number, [a, b]: [number, number], step = 100): number {
  return Math.round((a + r() * (b - a)) / step) * step
}

export interface SampleOptions {
  months?: number
  seed?: number
  /** 기본값 repos */
  target?: Repos
}

/**
 * 데모/테스트용 샘플 데이터. 최근 N개월의 급여·월세·구독·일상 지출·이체·환불을 넣는다.
 * DB에 카테고리가 없으면 소형 기본 세트를 먼저 넣는다.
 */
export async function seedSampleData(opts: SampleOptions = {}): Promise<{ transactions: number }> {
  const r = rng(opts.seed ?? 20260905)
  const target = opts.target ?? repos
  const months = opts.months ?? 6
  const today = todayKey()

  let cats = await target.categories.all()
  if (cats.length === 0) {
    for (const c of MINI_CATEGORIES) await target.categories.add(c)
    cats = await target.categories.all()
  }
  const byName = (names: string[], kind: Category['kind']) => {
    for (const n of names) {
      const c = cats.find((x) => x.kind === kind && x.name === n)
      if (c) return c.id
    }
    const top = cats.find((x) => x.kind === kind && x.parentId === null)
    return top ? top.id : null
  }

  const accounts = await target.accounts.all()
  const acc = (t: 'card' | 'bank' | 'cash') => accounts.find((a) => a.type === t)?.id ?? accounts[0]?.id ?? null

  const salaryCat = byName(['급여', '월급'], 'income')
  const rentCat = byName(['월세', '주거·공과금', '주거/공과금', '주거', '주거비'], 'expense')
  const utilCat = byName(['공과금', '전기·가스·수도', '주거·공과금', '주거'], 'expense')
  const telecomCat = byName(['통신', '통신비', '휴대폰'], 'expense')
  const subCat = byName(['구독', 'OTT·구독', '구독·멤버십', '문화·여가'], 'expense')

  const cur = currentMonthKey()
  const rows: NewTransaction[] = []
  for (let i = months - 1; i >= 0; i--) {
    const m = addMonths(cur, -i)
    const dim = daysInMonth(m)
    const add = (type: TxType, day: number, amount: number, categoryId: string | null, payee: string, account: 'card' | 'bank' | 'cash', extra: Partial<{ isRefund: boolean; toAccountId: string | null; memo: string }> = {}) => {
      const date = dateInMonth(m, day)
      if (date > today) return
      rows.push({
        type,
        date,
        amount,
        categoryId: type === 'transfer' ? null : categoryId,
        accountId: acc(account),
        toAccountId: extra.toAccountId ?? null,
        payee,
        memo: extra.memo ?? '',
        isRefund: extra.isRefund ?? false,
        source: 'manual' as const,
      })
    }
    add('income', 25, 3_200_000 + (i % 3 === 0 ? 200_000 : 0), salaryCat, '(주)회사 급여', 'bank', { memo: `${Number(m.slice(5))}월 급여` })
    add('expense', 1, 650_000, rentCat, '월세', 'bank')
    add('expense', 10, between(r, [60_000, 140_000], 10), utilCat, '관리비·전기요금', 'bank')
    add('expense', 15, 55_000, telecomCat, 'SKT', 'card')
    add('expense', 5, 17_000, subCat, '넷플릭스', 'card')
    add('expense', 12, 14_900, subCat, '유튜브 프리미엄', 'card')
    for (const t of TEMPLATES) {
      const n = Math.round(between(r, t.perMonth, 1))
      for (let k = 0; k < n; k++) {
        add(t.type, 1 + Math.floor(r() * dim), between(r, t.amount), byName(t.category, t.type === 'income' ? 'income' : 'expense'), pick(r, t.payees), t.account)
      }
    }
    // 카드대금 납부: 은행 → 카드 이체 (수입/지출 아님)
    if (acc('bank') && acc('card') && acc('bank') !== acc('card')) add('transfer', 27, between(r, [700_000, 1_100_000], 1000), null, '카드대금 납부', 'bank', { toAccountId: acc('card') })
    // 환불 한 건
    if (i % 2 === 0) add('expense', 20, between(r, [20_000, 60_000]), byName(['온라인쇼핑', '쇼핑'], 'expense'), '쿠팡 반품 환불', 'card', { isRefund: true })
  }
  await target.transactions.bulkAdd(rows)
  return { transactions: rows.length }
}
