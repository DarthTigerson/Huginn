/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Toggle } from '../Toggle'

afterEach(() => cleanup())

describe('Toggle', () => {
  it('calls onChange when clicked', () => {
    const onChange = vi.fn()
    render(<Toggle label="Enable X" description="desc" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Enable X' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('renders as disabled and does not call onChange when clicked, given disabled', () => {
    const onChange = vi.fn()
    render(<Toggle label="Enable X" description="desc" checked={false} onChange={onChange} disabled />)
    const toggle = screen.getByRole('switch', { name: 'Enable X' })
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(onChange).not.toHaveBeenCalled()
  })
})
