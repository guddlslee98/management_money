import { describe, expect, it } from 'vitest'
import type { ClassifyRule } from '../db/types'
import { createClassifier, normalizeText, suggestPattern } from './classify'

const r = (pattern: string, categoryId: string, priority = 50, source: ClassifyRule['source'] = 'default'): ClassifyRule => ({
  id: pattern,
  pattern,
  categoryId,
  priority,
  source,
  createdAt: 0,
})

describe('classify', () => {
  const clf = createClassifier([
    r('스타벅스|starbucks', 'food.cafe', 100),
    r('커피|카페', 'food.cafe', 50),
    r('GS25|CU|세븐일레븐', 'living.convenience', 100),
    r('배달의민족|배민', 'food.delivery', 100),
    r('쿠팡이츠', 'food.delivery', 110),
    r('쿠팡', 'shopping.online', 100),
    r('급여|월급', 'income.salary', 100),
  ])

  it('normalizes text', () => {
    expect(normalizeText(' 스타벅스 강남역점 ')).toBe('스타벅스강남역점')
    expect(normalizeText('GS25 (역삼)')).toBe('gs25역삼')
  })

  it('matches keywords case-insensitively and ignoring spaces', () => {
    expect(clf.classify('STARBUCKS 강남')).toBe('food.cafe')
    expect(clf.classify('스타 벅스')).toBe('food.cafe')
    expect(clf.classify('gs25 역삼점')).toBe('living.convenience')
  })

  it('prefers higher priority then longer keyword', () => {
    expect(clf.classify('쿠팡이츠 결제')).toBe('food.delivery')
    expect(clf.classify('쿠팡 로켓배송')).toBe('shopping.online')
    expect(clf.classify('동네 커피집')).toBe('food.cafe')
  })

  it('requires word boundaries for short ASCII keywords', () => {
    const c = createClassifier([r('cu|씨유', 'living.convenience', 90), r('kt', 'telecom', 100), r('pub|호프', 'food.alcohol', 50), r('coffee', 'food.cafe', 40)])
    expect(c.classify('CU 역삼점')).toBe('living.convenience')
    expect(c.classify('cu편의점')).toBe('living.convenience')
    expect(c.classify('CULTURELAND')).toBeNull()
    expect(c.classify('KIWOOM SECURITIES')).toBeNull()
    expect(c.classify('KT 통신요금')).toBe('telecom')
    expect(c.classify('COCKTAIL BAR')).toBeNull()
    expect(c.classify('PUBG')).toBeNull()
    expect(c.classify('Republic of Coffee')).toBe('food.cafe')
  })

  it('searches payee and memo together and returns null when nothing matches', () => {
    expect(clf.classify('알 수 없음', '9월 급여')).toBe('income.salary')
    expect(clf.classify('알 수 없음')).toBeNull()
    expect(clf.classify(null, undefined, '')).toBeNull()
    expect(clf.match('배민 주문')?.rule.pattern).toBe('배달의민족|배민')
  })
})

describe('suggestPattern', () => {
  it('strips branch suffixes and numbers', () => {
    expect(suggestPattern('스타벅스 강남역점')).toBe('스타벅스')
    expect(suggestPattern('(주)우아한형제들')).toBe('우아한형제들')
    expect(suggestPattern('GS25 역삼2호점')).toBe('GS25')
    expect(suggestPattern('스타벅스강남역점')).toBe('스타벅스강남역점')
    expect(suggestPattern('CU 역삼점 3')).toBe('CU')
    expect(suggestPattern('CU')).toBe('CU')
    expect(suggestPattern('123')).toBeNull()
  })
})
