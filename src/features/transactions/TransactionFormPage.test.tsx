import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { repos } from '../../db/repo'
import type { Category } from '../../db/types'
import TransactionFormPage from './TransactionFormPage'

const cats: Category[] = [
  { id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'food.cafe', kind: 'expense', name: '카페', emoji: '☕', color: '#f97316', parentId: 'food', sortOrder: 0, isArchived: false },
  { id: 'transport', kind: 'expense', name: '교통', emoji: '🚌', color: '#0ea5e9', parentId: null, sortOrder: 1, isArchived: false },
  { id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0, isArchived: false },
]

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/transactions" element={<div>list-page</div>} />
        <Route path="/transactions/new" element={<TransactionFormPage />} />
        <Route path="/transactions/:id" element={<TransactionFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// vitest globals 미사용 → Testing Library 자동 cleanup이 등록되지 않으므로 직접 등록
afterEach(cleanup)
beforeEach(async () => {
  await repos.clearAll()
  await repos.ensureSeeded({ categories: cats, rules: [{ pattern: '스타벅스|메가커피', categoryId: 'food.cafe', priority: 100 }] })
})

describe('TransactionFormPage', () => {
  it('submits a valid expense with a picked category and navigates to the month list', async () => {
    renderAt('/transactions/new?type=expense&date=2026-09-03')

    const amount = screen.getByLabelText('금액') as HTMLInputElement
    fireEvent.change(amount, { target: { value: '12000' } })
    expect(amount.value).toBe('12,000')

    // 카테고리: 대분류 격자 → 소분류 칩
    fireEvent.click(screen.getByRole('button', { name: /카테고리 선택/ }))
    fireEvent.click(await screen.findByRole('button', { name: /식비/ }))
    fireEvent.click(await screen.findByRole('button', { name: /카페/ }))
    expect(screen.getByRole('button', { name: /카페/ })).toBeInTheDocument()

    fireEvent.change(await screen.findByLabelText('계좌'), { target: { value: 'acc.card' } })
    fireEvent.change(screen.getByLabelText('거래처'), { target: { value: '스타벅스 강남점' } })
    fireEvent.change(screen.getByLabelText('메모'), { target: { value: '아메리카노' } })

    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(async () => expect(await repos.transactions.count()).toBe(1))
    const [tx] = await repos.transactions.all()
    expect(tx).toMatchObject({ type: 'expense', date: '2026-09-03', month: '2026-09', amount: 12000, categoryId: 'food.cafe', accountId: 'acc.card', payee: '스타벅스 강남점', memo: '아메리카노', isRefund: false, source: 'manual' })
    expect(await screen.findByText('list-page')).toBeInTheDocument()
  })

  it('suggests a category from the payee and shows validation errors', async () => {
    renderAt('/transactions/new')
    fireEvent.change(screen.getByLabelText('거래처'), { target: { value: '메가커피 역삼점' } })
    expect(await screen.findByText(/추천:/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /추천 카테고리 카페 적용/ }))
    expect(screen.getByRole('button', { name: /카페/ })).toBeInTheDocument()
    expect(screen.queryByText(/추천:/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('금액을 입력하세요')
    expect(await repos.transactions.count()).toBe(0)
  })

  it('rejects a transfer with the same account on both sides', async () => {
    renderAt('/transactions/new?type=transfer&from=acc.bank')
    fireEvent.change(screen.getByLabelText('금액'), { target: { value: '500000' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('이체는 출금 계좌와 입금 계좌가 모두 필요합니다')

    fireEvent.change(await screen.findByLabelText('입금 계좌'), { target: { value: 'acc.card' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(async () => expect(await repos.transactions.count()).toBe(1))
    const [tx] = await repos.transactions.all()
    expect(tx).toMatchObject({ type: 'transfer', accountId: 'acc.bank', toAccountId: 'acc.card', categoryId: null })
  })

  it('edits and deletes an existing transaction', async () => {
    const tx = await repos.transactions.add({ type: 'expense', date: '2026-08-10', amount: 4500, categoryId: 'food', accountId: 'acc.cash', toAccountId: null, payee: '김밥천국', memo: '', isRefund: false })
    renderAt(`/transactions/${tx.id}`)
    const payee = (await screen.findByLabelText('거래처')) as HTMLInputElement
    expect(payee.value).toBe('김밥천국')
    fireEvent.change(screen.getByLabelText('금액'), { target: { value: '5,000' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(async () => expect((await repos.transactions.get(tx.id))?.amount).toBe(5000))
    expect(await screen.findByText('list-page')).toBeInTheDocument()

    cleanup()
    window.confirm = () => true
    renderAt(`/transactions/${tx.id}`)
    fireEvent.click(await screen.findByRole('button', { name: '삭제' }))
    await waitFor(async () => expect(await repos.transactions.count()).toBe(0))
  })
})
