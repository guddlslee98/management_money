import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repos } from '../../db/repo'
import type { Category } from '../../db/types'
import { formatKRW } from '../../domain/money'
import HomePage from './HomePage'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'housing', kind: 'expense', name: '주거', emoji: '🏠', color: '#3b82f6', parentId: null, sortOrder: 1, isArchived: false },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]

async function seed() {
  for (const c of cats) await repos.categories.add(c)
  const base = { accountId: null, toAccountId: null, memo: '', isRefund: false }
  await repos.transactions.bulkAdd([
    { ...base, type: 'income', date: '2026-09-25', amount: 3_000_000, categoryId: 'salary', payee: '회사' },
    { ...base, type: 'expense', date: '2026-09-01', amount: 600_000, categoryId: 'housing', payee: '월세 이체' },
    { ...base, type: 'expense', date: '2026-09-02', amount: 120_000, categoryId: 'food.cafe', payee: '스타벅스' },
    { ...base, type: 'income', date: '2026-08-25', amount: 2_500_000, categoryId: 'salary', payee: '회사' },
    { ...base, type: 'expense', date: '2026-08-01', amount: 500_000, categoryId: 'housing', payee: '월세 이체' },
  ])
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <HomePage />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await repos.clearAll()
})
afterEach(cleanup)

describe('HomePage', () => {
  it('shows monthly totals, deltas and category shares with drill-down', async () => {
    await seed()
    renderAt('/?m=2026-09')

    expect((await screen.findAllByText(formatKRW(3_000_000))).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(formatKRW(720_000))).length).toBeGreaterThan(0)
    expect(screen.getByText(formatKRW(2_280_000))).toBeInTheDocument()
    expect(screen.getByText('저축률 76.0%')).toBeInTheDocument()
    // 전월 대비: 수입 +500,000 (20.0%), 지출 +220,000 (44.0%)
    expect(screen.getByText('▲ +₩500,000')).toBeInTheDocument()
    expect(screen.getByText('20.0%')).toBeInTheDocument()
    expect(screen.getByText('▲ +₩220,000')).toBeInTheDocument()

    // 지출 구성: 주거 83.3%, 식비 16.7% — 식비를 누르면 소분류(카페) 표시
    expect(screen.getByText('83.3%')).toBeInTheDocument()
    // '카페'는 최근 거래 행의 카테고리 표시로 1번만 존재해야 하고, 펼치면 소분류 행이 추가된다
    expect(screen.getAllByText('카페')).toHaveLength(1)
    const foodRow = screen.getByRole('button', { name: /식비/ })
    expect(foodRow).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(foodRow)
    expect(foodRow).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('카페')).toHaveLength(2)
    expect(screen.getByText('100.0%')).toBeInTheDocument()

    // 최근 거래 + 링크
    expect(screen.getByText('스타벅스')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '전체 보기 ›' })).toHaveAttribute('href', '/transactions?m=2026-09')
    expect(screen.queryByText('예산')).not.toBeInTheDocument()
  })

  it('shows the budget card only when budgets exist', async () => {
    await seed()
    await repos.budgets.set('housing', '*', 500_000)
    renderAt('/?m=2026-09')
    expect(await screen.findByText('예산')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getAllByRole('link', { name: '전체 보기 ›' })[0]).toHaveAttribute('href', '/budgets?m=2026-09')
  })

  it('shows the empty state for a month without transactions', async () => {
    await seed()
    renderAt('/?m=2020-01')
    expect(await screen.findByText('거래가 없어요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '거래 추가' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '파일 가져오기' })).toBeInTheDocument()
    expect(screen.getByText('2020년 1월에 기록된 거래가 없습니다')).toBeInTheDocument()
  })
})
