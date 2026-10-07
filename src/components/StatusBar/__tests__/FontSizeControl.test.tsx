import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { FontSizeControl } from '../FontSizeControl'
import { useFontSizeStore } from '@/stores/fontSizeStore'

beforeEach(() => {
  act(() => useFontSizeStore.getState().setFontSize(13))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('FontSizeControl', () => {
  it('shows the current size in a chip, with the − / + pill closed', () => {
    render(<FontSizeControl />)
    expect(screen.getByTestId('font-size-chip').textContent).toBe('13')
    expect(screen.queryByTestId('font-size-popover')).toBeNull()
  })

  it('opens the original − 13 + pill above the chip, and its buttons change the size', () => {
    render(<FontSizeControl />)
    fireEvent.click(screen.getByTestId('font-size-chip'))
    expect(screen.getByTestId('font-size-popover')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Increase font size' }))
    expect(useFontSizeStore.getState().fontSize).toBe(14)
    fireEvent.click(screen.getByRole('button', { name: 'Decrease font size' }))
    fireEvent.click(screen.getByRole('button', { name: 'Decrease font size' }))
    expect(useFontSizeStore.getState().fontSize).toBe(12)
    fireEvent.click(screen.getByRole('button', { name: 'Reset font size' }))
    expect(useFontSizeStore.getState().fontSize).toBe(13)
  })

  it('closes on an outside mousedown and on Escape', () => {
    render(<FontSizeControl />)
    fireEvent.click(screen.getByTestId('font-size-chip'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('font-size-popover')).toBeNull()

    fireEvent.click(screen.getByTestId('font-size-chip'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('font-size-popover')).toBeNull()
  })

  it('briefly highlights the chip when the size changes from the menu shortcuts', () => {
    vi.useFakeTimers()
    render(<FontSizeControl />)
    act(() => useFontSizeStore.getState().increase())
    const chip = screen.getByTestId('font-size-chip')
    expect(chip.textContent).toBe('14')
    expect(chip.className).toMatch(/text-accent/)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByTestId('font-size-chip').className).not.toMatch(/text-accent/)
  })
})
