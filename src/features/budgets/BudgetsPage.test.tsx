import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { budgetRepo, categoryRepo, repos, txRepo } from '../../db/repo'
import BudgetsPage from './BudgetsPage'

const T = { timeout: 10000 }
const renderPage = (month = '2026-09') =>
  render(
    <MemoryRouter initialEntries={[`/budgets?m=${month}`]}>
      <BudgetsPage />
    </MemoryRouter>,
  )

beforeEach(async () => {
  await repos.clearAll()
  await categoryRepo.add({ id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0 })
  await categoryRepo.add({ id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0 })
  await categoryRepo.add({ id: 'shopping', kind: 'expense', name: '쇼핑', emoji: '🛍️', color: '#ec4899', parentId: null, sortOrder: 1 })
  await txRepo.bulkAdd([
    { type: 'expense', date: '2026-09-03', amount: 120_000, categoryId: 'food.cafe', accountId: null, toAccountId: null, payee: '카페', memo: '', isRefund: false },
    { type: 'expense', date: '2026-09-04', amount: 130_000, categoryId: 'food', accountId: null, toAccountId: null, payee: '밥', memo: '', isRefund: false },
    { type: 'expense', date: '2026-08-10', amount: 123_456, categoryId: 'shopping', accountId: null, toAccountId: null, payee: '쿠팡', memo: '', isRefund: false },
  ])
})
afterEach(cleanup)

describe('BudgetsPage', () => {
  it('sets a default budget through the inline input and shows usage', async () => {
    renderPage()
    // 예산이 없으면 접힌 목록 안에 있다
    fireEvent.click(await screen.findByRole('button', { name: /예산 없는 카테고리/ }))
    const input = await screen.findByLabelText('식비 예산')
    fireEvent.change(input, { target: { value: '300000' } })
    expect((input as HTMLInputElement).value).toBe('300,000')
    fireEvent.blur(input)

    await waitFor(async () => {
      const all = await budgetRepo.all()
      expect(all).toHaveLength(1)
      expect(all[0]).toMatchObject({ categoryId: 'food', month: '*', amount: 300_000 })
    }, T)
    // 지출 250,000 / 예산 300,000 → 남음 50,000 (경고 상태)
    expect(await screen.findByText('남음 ₩50,000')).toBeInTheDocument()
    expect(screen.getByText('총 예산 vs 지출')).toBeInTheDocument()
    expect(screen.getByText('남은 금액')).toBeInTheDocument()
  })

  it('writes a month-only budget when the scope is 이번 달, and removes it with the ✕ tag', async () => {
    await budgetRepo.set('food', '*', 300_000)
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: '2026년 9월만' }))
    // 예산·거래가 모두 로드된 뒤의 입력 요소를 잡는다 (로드 중 재렌더링으로 요소가 교체될 수 있음)
    await screen.findByPlaceholderText('기본 ₩300,000')
    await waitFor(() => expect(screen.queryAllByText('…')).toHaveLength(0), T)
    const input = () => screen.getByPlaceholderText('기본 ₩300,000') as HTMLInputElement
    expect(input()).toHaveAccessibleName('식비 예산')
    fireEvent.change(input(), { target: { value: '200,000' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    fireEvent.blur(input())

    await waitFor(async () => {
      const all = await budgetRepo.all()
      expect(all.map((b) => [b.month, b.amount]).sort()).toEqual([
        ['*', 300_000],
        ['2026-09', 200_000],
      ])
    }, T)
    expect(await screen.findByText('초과 ₩50,000')).toBeInTheDocument()

    fireEvent.click(await screen.findByRole('button', { name: '식비 이번 달 전용 예산 삭제' }))
    await waitFor(async () => expect((await budgetRepo.all()).map((b) => b.month)).toEqual(['*']), T)
  })

  it('fills empty default budgets from the previous month rounded up to 10,000', async () => {
    renderPage()
    const fill = await screen.findByRole('button', { name: '지난달 지출을 예산으로 채우기' })
    await waitFor(() => expect(fill).toBeEnabled()) // 거래가 로드되어야 후보가 생긴다
    fireEvent.click(fill)
    fireEvent.click(await screen.findByRole('button', { name: '1개 카테고리 채우기' }))
    await waitFor(async () => {
      expect(await budgetRepo.all()).toEqual([expect.objectContaining({ categoryId: 'shopping', month: '*', amount: 130_000 })])
    }, T)
    expect(await screen.findByRole('status')).toHaveTextContent('1개 카테고리의 기본 예산을 채웠습니다')
  })
})
