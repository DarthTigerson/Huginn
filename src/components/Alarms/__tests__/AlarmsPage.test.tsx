import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { AlarmsPage } from '../AlarmsPage'
import { useAlarmStore } from '@/stores/alarmStore'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 8, 10, 0, 0))
  localStorage.clear()
  useAlarmStore.setState({ alarms: [], ringing: null })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
// The time field opens one panel with an Hour and a Minute column (T1).
const pickTime = (hh: string, mm: string) => {
  fireEvent.click(screen.getByLabelText('Time'))
  fireEvent.click(within(screen.getByRole('listbox', { name: 'Hour' })).getByRole('option', { name: hh }))
  fireEvent.click(within(screen.getByRole('listbox', { name: 'Minute' })).getByRole('option', { name: mm }))
}
describe('AlarmsPage', () => {
  it('picks the time from one panel with hour and minute columns, instead of the native picker', () => {
    render(<AlarmsPage />)
    expect(document.querySelector('input[type="time"]')).toBeNull()
    const field = screen.getByLabelText('Time')
    expect(field.textContent).toBe('09:00')

    fireEvent.click(field)
    expect(within(screen.getByRole('listbox', { name: 'Hour' })).getAllByRole('option')).toHaveLength(24)
    expect(within(screen.getByRole('listbox', { name: 'Minute' })).getAllByRole('option')).toHaveLength(60)

    // picking an hour keeps it open, picking a minute closes it
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Hour' })).getByRole('option', { name: '14' }))
    expect(screen.getByTestId('time-picker-panel')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('listbox', { name: 'Minute' })).getByRole('option', { name: '45' }))
    expect(screen.queryByTestId('time-picker-panel')).toBeNull()
    expect(field.textContent).toBe('14:45')
  })

  it('closes the time panel on Escape and on an outside click', () => {
    render(<AlarmsPage />)
    fireEvent.click(screen.getByLabelText('Time'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('time-picker-panel')).toBeNull()
    fireEvent.click(screen.getByLabelText('Time'))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByTestId('time-picker-panel')).toBeNull()
  })

  it('shows an empty state with nothing set', () => {
    render(<AlarmsPage />)
    expect(screen.getByText('No alarms yet. Add one below.')).toBeInTheDocument()
  })

  it('requires a name before an alarm can be added', () => {
    render(<AlarmsPage />)
    expect(screen.getByRole('button', { name: 'Add alarm' })).toBeDisabled()
    type('Name', 'Lunch')
    expect(screen.getByRole('button', { name: 'Add alarm' })).toBeEnabled()
  })

  it("adds a once alarm for the next time it's that o'clock, with no date to pick", () => {
    render(<AlarmsPage />)
    expect(screen.queryByLabelText('Date')).toBeNull()
    expect(screen.queryByText(/Rings once/)).toBeNull()

    type('Name', 'Dentist')
    pickTime('15', '00') // still ahead of 10:00 -> today
    fireEvent.click(screen.getByRole('button', { name: 'Add alarm' }))
    type('Name', 'Early')
    pickTime('08', '00') // already passed -> tomorrow
    fireEvent.click(screen.getByRole('button', { name: 'Add alarm' }))

    const byName = Object.fromEntries(useAlarmStore.getState().alarms.map((a) => [a.name, a]))
    expect(byName.Dentist).toMatchObject({ hour: 15, minute: 0, repeat: false, date: '2026-10-08' })
    expect(byName.Early).toMatchObject({ hour: 8, minute: 0, repeat: false, date: '2026-10-09' })
    const rows = screen.getAllByTestId('alarm-row').map((r) => r.textContent)
    expect(rows.find((t) => t?.includes('Dentist'))).toMatch(/Once · today/)
    expect(rows.find((t) => t?.includes('Early'))).toMatch(/Once · tomorrow/)
  })

  it('adds a repeating alarm on the chosen days (weekdays by default)', () => {
    render(<AlarmsPage />)
    type('Name', 'Stand-up')
    pickTime('09', '30')
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Friday' })) // drop Friday
    fireEvent.click(screen.getByRole('button', { name: 'Add alarm' }))

    const [a] = useAlarmStore.getState().alarms
    expect(a).toMatchObject({ name: 'Stand-up', repeat: true, days: [1, 2, 3, 4] })
    expect(screen.getByTestId('alarm-row').textContent).toMatch(/Mon, Tue, Wed, Thu/)
  })

  it('cannot add a repeating alarm with no days picked', () => {
    render(<AlarmsPage />)
    type('Name', 'Never')
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }))
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) fireEvent.click(screen.getByRole('button', { name: day }))
    expect(screen.getByRole('button', { name: 'Add alarm' })).toBeDisabled()
  })

  it('lists the repeat days Monday to Sunday, with no hint text beside them', () => {
    render(<AlarmsPage />)
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }))
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    const buttons = screen.getAllByRole('button').filter((b) => order.includes(b.getAttribute('aria-label') ?? ''))
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(order)
    expect(screen.queryByText('Weekdays')).toBeNull()
  })

  it('switches an alarm off and deletes it', () => {
    useAlarmStore.getState().addAlarm({ name: 'Lunch', hour: 12, minute: 45, repeat: true, days: [4] })
    render(<AlarmsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Lunch on' }))
    expect(useAlarmStore.getState().alarms[0].enabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }))
    expect(useAlarmStore.getState().alarms).toEqual([])
  })

  it('shows "Snoozed until" for a snoozed alarm', () => {
    useAlarmStore.getState().addAlarm({ name: 'Lunch', hour: 12, minute: 45, repeat: true, days: [4] })
    useAlarmStore.setState((s) => ({ alarms: s.alarms.map((a) => ({ ...a, snoozedUntil: Date.now() + 9 * 60000 })) }))
    render(<AlarmsPage />)
    expect(screen.getByTestId('alarm-row').textContent).toMatch(/Snoozed until 10:09/)
  })
})
