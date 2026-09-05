import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BudgetAmountInput } from './BudgetAmountInput'

describe('BudgetAmountInput', () => {
  it('commits on Enter and on blur, but Escape cancels without saving', () => {
    const onCommit = vi.fn()
    render(<BudgetAmountInput value={300_000} label="식비 예산" onCommit={onCommit} />)
    const input = screen.getByLabelText('식비 예산') as HTMLInputElement
    expect(input.value).toBe('300,000')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '999999' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
    expect(input.value).toBe('300,000')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '200000' } })
    fireEvent.blur(input)
    expect(onCommit).toHaveBeenCalledWith(200_000)
  })
})
