import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AlarmPopup } from '../AlarmPopup'
import { AlarmFlash } from '../AlarmFlash'
import { useAlarmStore } from '@/stores/alarmStore'

beforeEach(() => {
  localStorage.clear()
  useAlarmStore.setState({ alarms: [], ringing: null, flashColor: 'primary' })
  useAlarmStore.getState().addAlarm({ name: 'Stand-up', hour: 9, minute: 30, repeat: false, days: [], date: '2026-10-08' })
})

afterEach(() => {
  cleanup()
})

const ringIt = () => useAlarmStore.getState().ring(useAlarmStore.getState().alarms[0].id)

describe('AlarmPopup', () => {
  it('shows nothing unless an alarm is ringing', () => {
    render(<AlarmPopup />)
    expect(screen.queryByTestId('alarm-popup')).toBeNull()
  })

  it('shows the alarm name and time with Snooze and Stop', () => {
    ringIt()
    render(<AlarmPopup />)
    const popup = screen.getByTestId('alarm-popup')
    expect(popup.textContent).toMatch(/Stand-up/)
    expect(popup.textContent).toMatch(/9:30/)
    expect(screen.getByRole('button', { name: 'Snooze' })).toHaveAttribute('title', 'Snooze for 9 minutes')
  })

  it('Snooze closes it and schedules a re-ring', () => {
    ringIt()
    render(<AlarmPopup />)
    fireEvent.click(screen.getByRole('button', { name: 'Snooze' }))
    expect(screen.queryByTestId('alarm-popup')).toBeNull()
    expect(useAlarmStore.getState().alarms[0].snoozedUntil).not.toBeNull()
  })

  it('Stop closes it', () => {
    ringIt()
    render(<AlarmPopup />)
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.queryByTestId('alarm-popup')).toBeNull()
    expect(useAlarmStore.getState().ringing).toBeNull()
  })
})

describe('AlarmFlash', () => {
  it('runs only while an alarm rings, with comets on both sides', () => {
    const { rerender } = render(<AlarmFlash />)
    expect(screen.queryByTestId('alarm-flash')).toBeNull()
    ringIt()
    rerender(<AlarmFlash />)
    const flash = screen.getByTestId('alarm-flash')
    expect(flash.querySelectorAll('.alarm-flash-comet')).toHaveLength(8)
    expect(flash.querySelectorAll('.alarm-flash-edge')).toHaveLength(2)
  })

  it('uses the white variant when chosen', () => {
    useAlarmStore.setState({ flashColor: 'white' })
    ringIt()
    render(<AlarmFlash />)
    expect(screen.getByTestId('alarm-flash').className).toMatch(/alarm-flash-white/)
  })
})
