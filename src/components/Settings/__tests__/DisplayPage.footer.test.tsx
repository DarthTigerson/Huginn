/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DisplayPage } from '../DisplayPage'
import { useDisplayStore } from '@/stores/displayStore'

afterEach(() => {
  cleanup()
  useDisplayStore.setState({ footerContent: 'hints', memoryUsageVisible: true })
})

describe('DisplayPage — footer content + memory usage', () => {
  it('reflects the current footer content selection', () => {
    useDisplayStore.setState({ footerContent: 'clock' })
    render(<DisplayPage />)
    expect(screen.getByLabelText('Footer Content')).toHaveValue('clock')
  })

  it('changing the footer content dropdown updates the store', () => {
    render(<DisplayPage />)
    fireEvent.change(screen.getByLabelText('Footer Content'), { target: { value: 'clock' } })
    expect(useDisplayStore.getState().footerContent).toBe('clock')
  })

  it('reflects the current memory usage visibility', () => {
    useDisplayStore.setState({ memoryUsageVisible: false })
    render(<DisplayPage />)
    expect(screen.getByRole('switch', { name: 'Show memory usage' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggling memory usage visibility updates the store', () => {
    render(<DisplayPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Show memory usage' }))
    expect(useDisplayStore.getState().memoryUsageVisible).toBe(false)
  })
})
