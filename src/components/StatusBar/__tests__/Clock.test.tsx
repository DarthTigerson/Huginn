/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { Clock, formatLongDate } from '../Clock'
import { useAlarmStore } from '@/stores/alarmStore'
import { useEditorStore } from '@/stores/editorStore'
import { ALARMS_TAB_PATH } from '@/components/Settings/paths'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 1, 14, 32, 0))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Clock', () => {
  it('renders the current time', () => {
    render(<Clock />)
    expect(screen.getByText('2:32 PM')).toBeInTheDocument()
  })

  it('uses the full text colour so it is readable at a glance (VIDE-140)', () => {
    render(<Clock />)
    const button = screen.getByTestId('footer-clock-button')
    expect(button.className).toMatch(/\btext-fg\b/)
    expect(button.className).not.toMatch(/text-fg-subtle/)
  })

  it('updates as time passes', () => {
    render(<Clock />)
    act(() => {
      vi.setSystemTime(new Date(2026, 0, 1, 14, 33, 0))
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('2:33 PM')).toBeInTheDocument()
  })
})

describe('Clock — date tooltip', () => {
  it('shows the long date on hover', () => {
    render(<Clock />)
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Thursday the 1st of January')
  })

  it('formats ordinals, including the teens', () => {
    const on = (day: number) => formatLongDate(new Date(2026, 9, day))
    expect(on(8)).toBe('Thursday the 8th of October')
    expect(on(1)).toMatch(/the 1st of/)
    expect(on(2)).toMatch(/the 2nd of/)
    expect(on(3)).toMatch(/the 3rd of/)
    expect(on(11)).toMatch(/the 11th of/)
    expect(on(12)).toMatch(/the 12th of/)
    expect(on(13)).toMatch(/the 13th of/)
    expect(on(21)).toMatch(/the 21st of/)
    expect(on(22)).toMatch(/the 22nd of/)
    expect(on(23)).toMatch(/the 23rd of/)
  })
})

describe('Clock — alarms', () => {
  beforeEach(() => {
    localStorage.clear()
    useAlarmStore.setState({ alarms: [], ringing: null })
    useEditorStore.setState({ activeTabPath: null })
  })

  it('opens the Alarms tab when clicked', () => {
    render(<Clock />)
    fireEvent.click(screen.getByTestId('footer-clock-button'))
    expect(useEditorStore.getState().activeTabPath).toBe(ALARMS_TAB_PATH)
  })

  it('shows the alarm icon and the next alarm in the hover only while an alarm is on', () => {
    const { rerender } = render(<Clock />)
    expect(screen.queryByTestId('footer-clock-alarm')).toBeNull()
    act(() => useAlarmStore.getState().addAlarm({ name: 'Stand-up', hour: 15, minute: 0, repeat: false, days: [], date: '2026-01-01' }))
    rerender(<Clock />)
    expect(screen.getByTestId('footer-clock-alarm')).toBeInTheDocument()
    // 14:32 now (fixed clock above) -> 15:00 is 28 minutes away
    expect(screen.getByTestId('footer-clock-next-alarm').textContent).toBe('Stand-up at 3:00 PM · in 28 min')
  })

  it('turns accent and shows the alarm popup instead of the date while ringing', () => {
    act(() => useAlarmStore.getState().addAlarm({ name: 'Stand-up', hour: 15, minute: 0, repeat: false, days: [], date: '2026-01-01' }))
    act(() => useAlarmStore.getState().ring(useAlarmStore.getState().alarms[0].id))
    render(<Clock />)
    expect(screen.getByTestId('footer-clock-button').className).toMatch(/text-accent/)
    expect(screen.getByTestId('alarm-popup')).toBeInTheDocument()
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })
})
