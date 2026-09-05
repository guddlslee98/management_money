import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ needRefresh: [false, () => {}], offlineReady: [false, () => {}], updateServiceWorker: async () => {} }),
}))

describe('SettingsPage', () => {
  afterEach(cleanup)
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('theme segmented toggles html.dark and persists the mode', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('tab', { name: '시스템' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: '다크' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('mm.theme')).toBe('dark')
    expect(screen.getByRole('tab', { name: '다크' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: '라이트' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('mm.theme')).toBe('light')
  })

  it('renders app info and data actions', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /백업 화면 열기/ })).toHaveAttribute('href', '/more/backup')
    expect(screen.getByRole('button', { name: '모든 데이터 삭제' })).toBeInTheDocument()
  })

  it('delete-all requires typing 삭제 before confirming', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: '모든 데이터 삭제' }))
    const confirm = screen.getByRole('button', { name: '삭제 확인' })
    expect(confirm).toBeDisabled()
    await user.type(screen.getByLabelText(/계속하려면/), '삭제')
    expect(confirm).toBeEnabled()
  })
})
