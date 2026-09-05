import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { categoryRepo, recurringRepo, repos, txRepo } from '../../db/repo'
import { addMonths, currentMonthKey } from '../../domain/dates'
import RecurringPage from './RecurringPage'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/more/recurring']}>
      <RecurringPage />
    </MemoryRouter>,
  )

beforeEach(async () => {
  await repos.clearAll()
  await repos.ensureSeeded({ categories: [], rules: [] }) // 기본 계좌 3개
  await categoryRepo.add({ id: 'housing', kind: 'expense', name: '주거', emoji: '🏠', color: '#3b82f6', parentId: null, sortOrder: 0 })
  await categoryRepo.add({ id: 'housing.rent', kind: 'expense', name: '월세', emoji: '🏠', color: '#3b82f6', parentId: 'housing', sortOrder: 0 })
  await categoryRepo.add({ id: 'salary', kind: 'income', name: '급여', emoji: '💼', color: '#22c55e', parentId: null, sortOrder: 0 })
})
afterEach(cleanup)

describe('RecurringPage', () => {
  it('adds a rule through the form, lists it, and generates due transactions', async () => {
    renderPage()
    expect(await screen.findByText('반복 거래가 없습니다')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: '반복 거래 추가' })[0])

    fireEvent.change(await screen.findByLabelText('금액'), { target: { value: '650000' } })
    const cat = screen.getByLabelText('카테고리') as HTMLSelectElement
    expect(cat.querySelector('optgroup')?.getAttribute('label')).toBe('🏠 주거')
    expect(Array.from(cat.options).some((o) => o.value === 'salary')).toBe(false) // 지출 폼에는 수입 카테고리 없음
    fireEvent.change(cat, { target: { value: 'housing.rent' } })
    fireEvent.change(screen.getByLabelText('계좌'), { target: { value: 'acc.bank' } })
    fireEvent.change(screen.getByLabelText('거래처'), { target: { value: '월세' } })
    fireEvent.change(screen.getByLabelText(/반복일/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('시작 월'), { target: { value: addMonths(currentMonthKey(), -2) } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))

    // 목록에 나타난다
    expect(await screen.findByText('월세')).toBeInTheDocument()
    expect(screen.getByText(/매월 1일/)).toBeInTheDocument()
    expect(screen.getByText('₩650,000')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '월세 활성' })).toHaveAttribute('aria-checked', 'true')
    const rules = await recurringRepo.all()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ type: 'expense', amount: 650_000, categoryId: 'housing.rent', accountId: 'acc.bank', dayOfMonth: 1 })

    // 지금 생성: 2달 전 1일부터 오늘까지 발생분(최소 3건: 2달 전, 1달 전, 이번 달 1일)
    fireEvent.click(screen.getByRole('button', { name: '지금 생성' }))
    expect(await screen.findByRole('status')).toHaveTextContent('3건 생성됨')
    expect(await txRepo.byRecurringRule(rules[0].id)).toHaveLength(3)
    expect(await screen.findByText(/매월 1일.*3건 생성/)).toBeInTheDocument() // 규칙 행의 생성 건수

    // 다시 눌러도 멱등
    fireEvent.click(screen.getByRole('button', { name: '지금 생성' }))
    expect(await screen.findByText('0건 생성됨')).toBeInTheDocument()
  })

  it('shows validation errors and toggles active state', async () => {
    await recurringRepo.add({ type: 'income', amount: 3_000_000, categoryId: 'salary', accountId: 'acc.bank', toAccountId: null, payee: '급여', memo: '', dayOfMonth: 25, startMonth: '2026-01', endMonth: null, isActive: true })
    renderPage()
    const sw = await screen.findByRole('switch', { name: '급여 활성' })
    fireEvent.click(sw)
    await waitFor(async () => expect((await recurringRepo.all())[0].isActive).toBe(false))

    fireEvent.click(screen.getByRole('button', { name: '반복 거래 추가' }))
    fireEvent.click(screen.getByRole('tab', { name: '이체' }))
    expect(screen.queryByLabelText('카테고리')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('금액'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('출금 계좌'), { target: { value: 'acc.bank' } })
    fireEvent.change(screen.getByLabelText('입금 계좌'), { target: { value: 'acc.bank' } })
    fireEvent.click(screen.getByRole('button', { name: '추가' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('출금 계좌와 입금 계좌가 같을 수 없습니다')
    expect(await recurringRepo.all()).toHaveLength(1)
  })
})
