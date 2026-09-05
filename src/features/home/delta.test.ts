import { describe, expect, it } from 'vitest'
import { deltaOf } from './delta'

describe('deltaOf', () => {
  it('computes difference and ratio against the previous value', () => {
    expect(deltaOf(1_200_000, 1_000_000)).toEqual({ delta: 200_000, deltaPct: 0.2 })
    expect(deltaOf(800_000, 1_000_000)).toEqual({ delta: -200_000, deltaPct: -0.2 })
    expect(deltaOf(500, 500)).toEqual({ delta: 0, deltaPct: 0 })
  })

  it('uses the absolute previous value and returns null ratio for zero', () => {
    expect(deltaOf(-100, -200)).toEqual({ delta: 100, deltaPct: 0.5 })
    expect(deltaOf(300, 0)).toEqual({ delta: 300, deltaPct: null })
  })
})
