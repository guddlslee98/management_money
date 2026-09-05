import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { repos } from '../../db/repo'
import BackupPage from './BackupPage'
import { reloadApp } from './browser'
import { toBackupJson } from './serialize'

vi.mock('./browser', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./browser')>()
  return { ...mod, downloadTextFile: vi.fn(), reloadApp: vi.fn() }
})

const seedTwo = async () => {
  await repos.ensureSeeded({ categories: [{ id: 'food', kind: 'expense', name: '식비', emoji: '🍚', color: '#f97316', parentId: null, sortOrder: 0, isArchived: false }], rules: [] })
  await repos.transactions.add({ type: 'expense', date: '2026-09-03', amount: 4500, categoryId: 'food', accountId: 'acc.card', toAccountId: null, payee: '김밥천국', memo: '', isRefund: false })
  await repos.transactions.add({ type: 'income', date: '2026-09-25', amount: 3_000_000, categoryId: null, accountId: 'acc.bank', toAccountId: null, payee: '회사', memo: '', isRefund: false })
}

describe('BackupPage', () => {
  afterEach(cleanup)
  beforeEach(async () => {
    vi.mocked(reloadApp).mockClear()
    await repos.clearAll()
  })

  it('shows live table counts', async () => {
    await seedTwo()
    render(
      <MemoryRouter>
        <BackupPage />
      </MemoryRouter>,
    )
    const counts = screen.getByTestId('data-counts')
    await waitFor(() => expect(counts).toHaveTextContent('거래2'))
    expect(counts).toHaveTextContent('계좌3')
  })

  it('restores a dumpAll backup in replace mode and reloads', async () => {
    await seedTwo()
    const json = toBackupJson(await repos.dumpAll())
    await repos.clearAll()
    expect(await repos.transactions.count()).toBe(0)

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <BackupPage />
      </MemoryRouter>,
    )
    const file = new File([json], 'management-money-backup-2026-09-05.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('백업 파일 (.json)'), file)

    await screen.findByText('management-money-backup-2026-09-05.json')
    const summary = within(screen.getByTestId('restore-summary'))
    expect(summary.getByText('거래').closest('li')).toHaveTextContent('2건')
    expect(summary.getByText('계좌').closest('li')).toHaveTextContent('3건')
    expect(screen.getByRole('radio', { name: /덮어쓰기/ })).toBeChecked()

    await user.click(screen.getByRole('button', { name: '복원하기' }))
    await user.click(await screen.findByRole('button', { name: '복원 확인' }))

    await screen.findByText(/복원을 완료했어요/)
    expect(await repos.transactions.count()).toBe(2)
    expect((await repos.transactions.all()).map((t) => t.payee).sort()).toEqual(['김밥천국', '회사'])
    expect((await repos.accounts.all()).length).toBe(3)
    await waitFor(() => expect(reloadApp).toHaveBeenCalled(), { timeout: 3000 })
  })

  it('rejects a non-backup file with a Korean message', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <BackupPage />
      </MemoryRouter>,
    )
    await user.upload(screen.getByLabelText('백업 파일 (.json)'), new File(['{"app":"other"}'], 'x.json', { type: 'application/json' }))
    await screen.findByText('이 앱(가계부)의 백업 파일이 아닙니다')
    expect(screen.queryByRole('button', { name: '복원하기' })).not.toBeInTheDocument()
  })
})
