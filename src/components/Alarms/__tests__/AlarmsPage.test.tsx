import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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

describe('AlarmsPage', () => {
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

  it('adds a once alarm for the chosen date, defaulting to Once', () => {
    render(<AlarmsPage />)
    type('Name', 'Dentist')
    type('Time', '15:00')
    type('Date', '2026-10-09')
    fireEvent.click(screen.getByRole('button', { name: 'Add alarm' }))

    const [a] = useAlarmStore.getState().alarms
    expect(a).toMatchObject({ name: 'Dentist', hour: 15, minute: 0, repeat: false, date: '2026-10-09' })
    expect(screen.getByTestId('alarm-row').textContent).toMatch(/Once · tomorrow/)
  })

  it('adds a repeating alarm on the chosen days (weekdays by default)', () => {
    render(<AlarmsPage />)
    type('Name', 'Stand-up')
    type('Time', '09:30')
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Friday' })) // drop Friday
    fireEvent.click(screen.getByRole('button', { name: 'Add alarm' }))

    const [a] = useAlarmStore.getState().alarms
    expect(a).toMatchObject({ name: 'Stand-up', repeat: true, days: [1, 2, 3, 4], date: null })
    expect(screen.getByTestId('alarm-row').textContent).toMatch(/Mon, Tue, Wed, Thu/)
  })

  it('cannot add a repeating alarm with no days picked', () => {
    render(<AlarmsPage />)
    type('Name', 'Never')
    fireEvent.click(screen.getByRole('radio', { name: 'Repeat' }))
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) fireEvent.click(screen.getByRole('button', { name: day }))
    expect(screen.getByRole('button', { name: 'Add alarm' })).toBeDisabled()
    expect(screen.getByText('Pick at least one day')).toBeInTheDocument()
  })

  it('switches an alarm off and deletes it', () => {
    useAlarmStore.getState().addAlarm({ name: 'Lunch', hour: 12, minute: 45, repeat: true, days: [4], date: null })
    render(<AlarmsPage />)
    fireEvent.click(screen.getByRole('switch', { name: 'Lunch on' }))
    expect(useAlarmStore.getState().alarms[0].enabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Lunch' }))
    expect(useAlarmStore.getState().alarms).toEqual([])
  })

  it('shows "Snoozed until" for a snoozed alarm', () => {
    useAlarmStore.getState().addAlarm({ name: 'Lunch', hour: 12, minute: 45, repeat: true, days: [4], date: null })
    useAlarmStore.setState((s) => ({ alarms: s.alarms.map((a) => ({ ...a, snoozedUntil: Date.now() + 9 * 60000 })) }))
    render(<AlarmsPage />)
    expect(screen.getByTestId('alarm-row').textContent).toMatch(/Snoozed until 10:09/)
  })
})
