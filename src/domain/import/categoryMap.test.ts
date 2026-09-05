import { describe, expect, it } from 'vitest'
import type { Category, ClassifyRule } from '../../db/types'
import { mapRawCategory, suggestCategories } from './categoryMap'
import type { ParsedRow } from './profiles'

const cat = (id: string, name: string, kind: Category['kind'], parentId: string | null = null): Category => ({
  id,
  kind,
  name,
  emoji: '',
  color: '#000',
  parentId,
  sortOrder: 0,
  isArchived: false,
})

const CATS: Category[] = [
  cat('food', '식비', 'expense'),
  cat('food.out', '외식', 'expense', 'food'),
  cat('cafe', '카페·간식', 'expense'),
  cat('mart', '마트·편의점', 'expense'),
  cat('transport', '교통', 'expense'),
  cat('salary', '급여', 'income'),
  cat('side', '부수입', 'income'),
]

const row = (over: Partial<ParsedRow>): ParsedRow => ({
  rowIndex: 0,
  date: '2026-08-01',
  amount: 1000,
  type: 'expense',
  flow: 'out',
  isRefund: false,
  payee: '',
  memo: '',
  errors: [],
  ...over,
})

describe('mapRawCategory', () => {
  it('matches subcategory names exactly first', () => {
    expect(mapRawCategory({ major: '식비', minor: '외식' }, CATS, 'expense')).toBe('food.out')
    expect(mapRawCategory({ major: '식비', minor: '' }, CATS, 'expense')).toBe('food')
  })

  it('ignores punctuation differences (·, /, spaces)', () => {
    expect(mapRawCategory({ major: '카페/간식' }, CATS, 'expense')).toBe('cafe')
    expect(mapRawCategory({ major: '마트 편의점' }, CATS, 'expense')).toBe('mart')
  })

  it('falls back to contains and alias tables', () => {
    expect(mapRawCategory({ major: '마트/편의점', minor: '편의점' }, CATS, 'expense')).toBe('mart')
    expect(mapRawCategory({ major: '커피' }, CATS, 'expense')).toBe('cafe')
    expect(mapRawCategory({ major: '대중교통', minor: '버스' }, CATS, 'expense')).toBe('transport')
    expect(mapRawCategory({ major: '월급' }, CATS, 'income')).toBe('salary')
  })

  it('respects kind and returns null when nothing matches', () => {
    expect(mapRawCategory({ major: '급여' }, CATS, 'expense')).toBeNull()
    expect(mapRawCategory({ major: '없는분류' }, CATS, 'expense')).toBeNull()
    expect(mapRawCategory(undefined, CATS, 'expense')).toBeNull()
  })
})

describe('suggestCategories', () => {
  const rules: ClassifyRule[] = [
    { id: 'r1', pattern: '스타벅스|메가커피', categoryId: 'cafe', source: 'default', priority: 0, createdAt: 0 },
    { id: 'r2', pattern: '이마트', categoryId: 'mart', source: 'user', priority: 1000, createdAt: 0 },
    { id: 'r3', pattern: '당근', categoryId: 'side', source: 'default', priority: 0, createdAt: 0 },
  ]

  it('prefers the raw category, then keyword rules, and never classifies transfers', () => {
    const rows = [
      row({ payee: '스타벅스 강남점', rawCategory: { major: '식비', minor: '외식' } }),
      row({ payee: '스타벅스 강남점' }),
      row({ payee: '이마트 성수점', memo: '장보기' }),
      row({ payee: '카드대금', type: 'transfer' }),
      row({ payee: '알 수 없음' }),
      row({ payee: '당근마켓', type: 'income', flow: 'in' }),
      // 규칙이 가리키는 카테고리 종류가 다르면 무시
      row({ payee: '당근마켓', type: 'expense' }),
    ]
    expect(suggestCategories(rows, CATS, rules)).toEqual(['food.out', 'cafe', 'mart', null, null, 'side', null])
  })

  it('handles thousands of rows quickly thanks to caching', () => {
    const rows = Array.from({ length: 5000 }, (_, i) => row({ rowIndex: i, payee: i % 2 ? '스타벅스' : '이마트' }))
    const t0 = performance.now()
    const out = suggestCategories(rows, CATS, rules)
    expect(out[0]).toBe('mart')
    expect(out[1]).toBe('cafe')
    expect(performance.now() - t0).toBeLessThan(1000)
  })
})
