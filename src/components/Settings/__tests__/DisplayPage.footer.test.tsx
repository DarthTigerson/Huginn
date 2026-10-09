/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DisplayPage } from '../DisplayPage'
import { useDisplayStore } from '@/stores/displayStore'

afterEach(() => {
  cleanup()
  useDisplayStore.setState({ memoryUsageVisible: true })
})

describe('DisplayPage — memory usage', () => {
  it('reflects the current memory usage visibility', () => {
    useDisplayStore.setState({ memoryUsageVisible: false })
    render(<DisplayPage />)
    expect(screen.getByRole('switch', { name: 'Memory usage' })).toHaveAttribute('aria-checked', 'false')
  })

  it('toggling memory usage visibility updates the store', () => {
    render(<DisplayPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Memory usage' }))
    expect(useDisplayStore.getState().memoryUsageVisible).toBe(false)
  })
})
