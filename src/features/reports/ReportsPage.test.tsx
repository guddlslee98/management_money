import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repos } from '../../db/repo'
import type { Category } from '../../db/types'
import { formatKRW } from '../../domain/money'
import ReportsPage from './ReportsPage'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'housing', kind: 'expense', name: '주거', emoji: '🏠', color: '#3b82f6', parentId: null, sortOrder: 1, isArchived: false },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]

async function seed() {
  for (const c of cats) await repos.categories.add(c)
  const base = { accountId: null, toAccountId: null, memo: '', isRefund: false }
  await repos.transactions.bulkAdd([
    { ...base, type: 'income', date: '2026-09-25', amount: 3_000_000, categoryId: 'salary', payee: '회사' },
    { ...base, type: 'expense', date: '2026-09-01', amount: 600_000, categoryId: 'housing', payee: '월세' },
    { ...base, type: 'expense', date: '2026-09-02', amount: 120_000, categoryId: 'food', payee: '식당' },
    { ...base, type: 'income', date: '2026-08-25', amount: 2_500_000, categoryId: 'salary', payee: '회사' },
    { ...base, type: 'expense', date: '2026-08-01', amount: 500_000, categoryId: 'housing', payee: '월세' },
  ])
}

function Probe() {
  const loc = useLocation()
  return <p>probe {loc.pathname + loc.search}</p>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/transactions" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await repos.clearAll()
})
afterEach(cleanup)

describe('ReportsPage', () => {
  it('renders month rows with average/total, switches period and links rows to transactions', async () => {
    await seed()
    renderAt('/reports?m=2026-09')

    expect(await screen.findByRole('link', { name: '9월' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '4월' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '3월' })).not.toBeInTheDocument()
    expect(screen.getByText('평균')).toBeInTheDocument()
    expect(screen.getByText('합계')).toBeInTheDocument()
    // 합계 수입 5,500,000 / 지출 1,220,000 / 평균 수입 916,667
    expect(screen.getAllByText(formatKRW(5_500_000)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(formatKRW(1_220_000)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(formatKRW(916_667)).length).toBeGreaterThan(0)
    // 9월 행 저축률 76.0%
    expect(screen.getByText('76.0%')).toBeInTheDocument()
    // 이번 달 vs 지난달: 주거 +100,000 (20.0%)
    expect(screen.getByText('▲ +₩100,000')).toBeInTheDocument()
    expect(screen.getByText(/지난달 ₩500,000/)).toBeInTheDocument()
    // 카테고리 추이 기본 선택: 금액이 가장 큰 대분류(주거)
    expect(screen.getByLabelText('대분류')).toHaveValue('housing')

    fireEvent.click(screen.getByRole('tab', { name: '12개월' }))
    expect(await screen.findByRole('link', { name: '10월' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '8월' }))
    expect(await screen.findByText('probe /transactions?m=2026-08')).toBeInTheDocument()
  })
})
