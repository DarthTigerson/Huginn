import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { TimePicker } from '../TimePicker'

afterEach(() => {
  cleanup()
})

describe('TimePicker', () => {
  it('on a 24-hour clock lists 00-23 with no AM/PM column', () => {
    render(<TimePicker hour={22} minute={5} onChange={() => {}} hour12={false} />)
    const field = screen.getByRole('button')
    expect(field.textContent).toBe('22:05')
    fireEvent.click(field)
    expect(within(screen.getByRole('listbox', { name: 'Hour' })).getAllByRole('option')).toHaveLength(24)
    expect(screen.queryByRole('listbox', { name: 'AM/PM' })).toBeNull()
  })

  it('on a 12-hour clock, switching AM/PM keeps the hour on the clock face', () => {
    const onChange = vi.fn()
    render(<TimePicker hour={10} minute={28} onChange={onChange} hour12 />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(within(screen.getByRole('listbox', { name: 'AM/PM' })).getByRole('option', { name: 'PM' }))
    expect(onChange).toHaveBeenLastCalledWith(22, 28)
  })
})
