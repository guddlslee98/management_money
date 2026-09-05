import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repos } from '../../db/repo'
import type { Category } from '../../db/types'
import TransactionsPage from './TransactionsPage'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/transactions" element={<TransactionsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// vitest globals 미사용 → Testing Library 자동 cleanup이 등록되지 않으므로 직접 등록
afterEach(cleanup)
beforeEach(async () => {
  await repos.clearAll()
  await repos.ensureSeeded({ categories: cats, rules: [] })
  const base = { toAccountId: null, memo: '', isRefund: false }
  await repos.transactions.bulkAdd([
    { ...base, type: 'expense', date: '2026-09-03', amount: 4500, categoryId: 'food.cafe', accountId: 'acc.card', payee: '스타벅스' },
    { ...base, type: 'income', date: '2026-09-25', amount: 3_000_000, categoryId: 'salary', accountId: 'acc.bank', payee: '회사', memo: '9월 급여' },
    { ...base, type: 'transfer', date: '2026-09-27', amount: 500_000, categoryId: null, accountId: 'acc.bank', toAccountId: 'acc.card', payee: '카드대금 납부' },
    { ...base, type: 'expense', date: '2026-09-03', amount: 10_000, categoryId: null, accountId: 'acc.card', payee: '쿠팡 반품', isRefund: true },
    { ...base, type: 'expense', date: '2026-08-30', amount: 99_999, categoryId: 'food', accountId: 'acc.cash', payee: '지난달' },
  ])
})

describe('TransactionsPage', () => {
  it('lists the month grouped by date with summary, signs and tags', async () => {
    renderAt('/transactions?m=2026-09')
    expect(await screen.findByText('스타벅스')).toBeInTheDocument()
    expect(screen.queryByText('지난달')).not.toBeInTheDocument()

    // 요약: 수입 3,000,000 / 지출 4,500 - 10,000 / 순수입 3,005,500
    const summary = screen.getByLabelText('월 요약')
    expect(within(summary).getByText('₩3,000,000')).toBeInTheDocument()
    expect(within(summary).getByText('-₩5,500')).toBeInTheDocument()
    expect(within(summary).getByText('+₩3,005,500')).toBeInTheDocument()

    // 날짜 헤더 + 그 날 지출 합계, 행 부호/태그
    const day = screen.getByRole('region', { name: '9월 3일 (목)' })
    expect(within(day).getByText('지출 -₩5,500')).toBeInTheDocument()
    expect(within(day).getByText('-₩4,500')).toBeInTheDocument()
    expect(within(day).getByText('+₩10,000')).toBeInTheDocument()
    expect(within(day).getByText('환불')).toBeInTheDocument()
    expect(screen.getByText('+₩3,000,000')).toBeInTheDocument()
    expect(screen.getByText('이체 · 은행 계좌 → 신용카드')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '거래 추가' })).toHaveAttribute('href', '/transactions/new?m=2026-09')
  })

  it('filters by type and searches payee/memo', async () => {
    renderAt('/transactions?m=2026-09')
    await screen.findByText('스타벅스')

    fireEvent.click(screen.getByRole('tab', { name: '이체' }))
    expect(screen.getByText('카드대금 납부')).toBeInTheDocument()
    expect(screen.queryByText('스타벅스')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '전체' }))
    fireEvent.change(screen.getByLabelText('거래처·메모 검색'), { target: { value: '급여' } })
    expect(screen.getByText('회사')).toBeInTheDocument()
    expect(screen.queryByText('스타벅스')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('거래처·메모 검색'), { target: { value: '없는거래처' } })
    expect(screen.getByText('조건에 맞는 거래가 없어요')).toBeInTheDocument()
  })

  it('shows an empty state for a month without transactions', async () => {
    renderAt('/transactions?m=2026-01')
    await waitFor(() => expect(screen.getByText('이 달에는 거래가 없어요')).toBeInTheDocument())
  })
})
