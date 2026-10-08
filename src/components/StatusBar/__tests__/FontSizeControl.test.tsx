import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { FontSizeControl } from '../FontSizeControl'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useEditorStore } from '@/stores/editorStore'
import { DISPLAY_TAB_PATH } from '@/components/Settings/paths'

beforeEach(() => {
  act(() => useFontSizeStore.getState().setFontSize(13))
  useEditorStore.setState({ activeTabPath: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('FontSizeControl', () => {
  it('shows the current size in a chip', () => {
    render(<FontSizeControl />)
    expect(screen.getByTestId('font-size-chip').textContent).toBe('13')
  })

  it('opens Settings > Display when clicked', () => {
    render(<FontSizeControl />)
    fireEvent.click(screen.getByTestId('font-size-chip'))
    expect(useEditorStore.getState().activeTabPath).toBe(DISPLAY_TAB_PATH)
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
