/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { Clock } from '../Clock'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 1, 14, 32, 0))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Clock', () => {
  it('renders the current time', () => {
    render(<Clock />)
    expect(screen.getByText('2:32 PM')).toBeInTheDocument()
  })

  it('uses the full text colour so it is readable at a glance (VIDE-140)', () => {
    render(<Clock />)
    expect(screen.getByText('2:32 PM').className).toMatch(/\btext-fg\b/)
    expect(screen.getByText('2:32 PM').className).not.toMatch(/text-fg-subtle/)
  })

  it('updates as time passes', () => {
    render(<Clock />)
    act(() => {
      vi.setSystemTime(new Date(2026, 0, 1, 14, 33, 0))
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('2:33 PM')).toBeInTheDocument()
  })
})
