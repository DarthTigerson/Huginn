/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { DisplayPage } from '../DisplayPage'
import { useDisplayStore } from '@/stores/displayStore'

afterEach(() => {
  cleanup()
  useDisplayStore.setState({ memoryUsageVisible: true, navbarPosition: 'left' })
})

describe('DisplayPage — feature blocks', () => {
  it('lays the page out as blocks, pickers first', () => {
    render(<DisplayPage />)
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Theme', 'Panel Style', 'Font', 'Editor Colors', 'Background', 'Memory usage', 'Navbar on the right',
    ])
  })

  it('previews the memory pill only while it is shown', () => {
    useDisplayStore.setState({ memoryUsageVisible: true })
    const { rerender } = render(<DisplayPage />)
    expect(screen.getByTestId('memory-preview-pill')).toBeInTheDocument()
    useDisplayStore.setState({ memoryUsageVisible: false })
    rerender(<DisplayPage />)
    expect(screen.queryByTestId('memory-preview-pill')).toBeNull()
  })

  it('previews which side the navbar sits on, and the block switch moves it', () => {
    render(<DisplayPage />)
    expect(screen.getByTestId('navbar-preview').firstElementChild).toHaveAttribute('data-side', 'left')
    fireEvent.click(screen.getByRole('switch', { name: 'Navbar on the right' }))
    expect(useDisplayStore.getState().navbarPosition).toBe('right')
    expect(screen.getByTestId('navbar-preview').firstElementChild).toHaveAttribute('data-side', 'right')
  })
})
