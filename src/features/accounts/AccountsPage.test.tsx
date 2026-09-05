import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accountRepo, repos, txRepo } from '../../db/repo'
import AccountsPage from './AccountsPage'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/more/accounts']}>
      <AccountsPage />
    </MemoryRouter>,
  )

beforeEach(async () => {
  await repos.clearAll()
  await accountRepo.add({ id: 'bank', name: '주거래 은행', type: 'bank', initialBalance: 1_000_000, color: '#2563eb' })
  await accountRepo.add({ id: 'card', name: '신용카드', type: 'card', initialBalance: 0, color: '#7c3aed' })
  await accountRepo.add({ id: 'old', name: '옛 통장', type: 'savings', initialBalance: 50_000, color: '#16a34a', isArchived: true })
  await txRepo.bulkAdd([
    { type: 'income', date: '2026-09-01', amount: 300_000, categoryId: null, accountId: 'bank', toAccountId: null, payee: '급여', memo: '', isRefund: false },
    { type: 'expense', date: '2026-09-02', amount: 45_000, categoryId: null, accountId: 'card', toAccountId: null, payee: '마트', memo: '', isRefund: false },
    { type: 'transfer', date: '2026-09-03', amount: 100_000, categoryId: null, accountId: 'bank', toAccountId: 'card', payee: '카드대금', memo: '', isRefund: false },
  ])
})
afterEach(cleanup)

describe('AccountsPage', () => {
  it('shows balances from accountBalances and net worth over non-archived accounts', async () => {
    renderPage()
    // bank: 1,000,000 + 300,000 − 100,000 = 1,200,000 / card: 0 − 45,000 + 100,000 = 55,000 / net = 1,255,000 (보관 계좌 제외)
    expect(await screen.findByText('₩1,200,000')).toBeInTheDocument()
    expect(await screen.findByText('₩55,000')).toBeInTheDocument()
    expect(await screen.findByText('₩1,255,000')).toBeInTheDocument()
    expect(screen.queryByText('옛 통장')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /보관된 계좌/ }))
    expect(await screen.findByText('옛 통장')).toBeInTheDocument()
  })

  it('expands an account to show recent transactions and quick links', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /주거래 은행/ }))
    expect(await screen.findByText('급여')).toBeInTheDocument()
    expect(screen.getByText('카드대금')).toBeInTheDocument()
    expect(screen.queryByText('마트')).not.toBeInTheDocument()
    expect(screen.getByText('+₩300,000')).toBeInTheDocument()
    expect(screen.getByText('-₩100,000')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+ 거래' })).toHaveAttribute('href', '/transactions/new?from=bank')
    expect(screen.getByRole('link', { name: '이체' })).toHaveAttribute('href', '/transactions/new?type=transfer&from=bank')
  })

  it('adds an account with a negative initial balance and deletes one with confirmation', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '계좌 추가' }))
    fireEvent.change(await screen.findByLabelText('이름'), { target: { value: '현대카드' } })
    fireEvent.change(screen.getByLabelText('종류'), { target: { value: 'card' } })
    fireEvent.change(screen.getByLabelText(/초기 잔액/), { target: { value: '-120000' } })
    fireEvent.click(screen.getByRole('radio', { name: '#ef4444' }))
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    await waitFor(async () => {
      const added = (await accountRepo.all()).find((a) => a.name === '현대카드')
      expect(added).toMatchObject({ type: 'card', initialBalance: -120_000, color: '#ef4444' })
    })
    expect(await screen.findByText('-₩120,000')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /신용카드/ }))
    fireEvent.click(await screen.findByRole('button', { name: '신용카드 삭제' }))
    expect(await screen.findByText(/거래는 남고 계좌 연결만 해제됩니다/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '삭제' }))
    await waitFor(async () => expect((await accountRepo.all()).some((a) => a.id === 'card')).toBe(false))
    expect((await txRepo.all()).find((t) => t.payee === '마트')?.accountId).toBeNull()
  })
})
