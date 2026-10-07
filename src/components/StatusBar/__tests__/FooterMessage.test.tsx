import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { FooterMessage, TEASER_MS } from '../FooterMessage'
import { useUpdateStore } from '@/stores/updateStore'
import { useUsageAlertStore } from '@/stores/usageAlertStore'
import { useDockerSettingsStore } from '@/stores/dockerSettingsStore'
import { useDockerStore } from '@/stores/dockerStore'
import { useNotificationPanelStore } from '@/stores/notificationPanelStore'
import { useNotificationAcknowledgedStore } from '@/stores/notificationAcknowledgedStore'
import { useNotificationArrivalStore } from '@/stores/notificationArrivalStore'

function resetStores() {
  useUpdateStore.setState({ available: null, status: 'idle', upToDateVersion: null })
  useUsageAlertStore.setState({ alerts: [] })
  useDockerSettingsStore.setState({ enabled: false })
  useDockerStore.setState({ status: 'unknown' })
  useNotificationPanelStore.setState({ open: false })
  useNotificationAcknowledgedStore.setState({ acknowledgedIds: [] })
  useNotificationArrivalStore.setState({ knownIds: [], arrival: null })
}

beforeEach(() => {
  resetStores()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 1, 14, 0, 0))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  resetStores()
})

const sessionAlert = () => ({ scope: 'session' as const, cutoffAt: new Date(2026, 0, 1, 16, 0, 0).getTime(), resetAt: null })

describe('FooterMessage — idle', () => {
  it('renders nothing in the center when there is nothing new', () => {
    const { container } = render(<FooterMessage />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('FooterMessage — temporary teaser for a new notification', () => {
  it('shows the new notification text, full width only', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<FooterMessage />)
    const teaser = screen.getByTestId('notification-teaser')
    expect(teaser.textContent).toMatch(/Session usage may run out in 02:00:00/)
    expect(teaser.className).toMatch(/hidden min-\[1200px\]:flex/)
  })

  it('goes away after the teaser window, while the notification stays active', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<FooterMessage />)
    expect(screen.getByTestId('notification-teaser')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(TEASER_MS)
    })
    expect(screen.queryByTestId('notification-teaser')).toBeNull()
  })

  it('ticks the countdown while showing', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<FooterMessage />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByTestId('notification-teaser').textContent).toMatch(/run out in 01:59:57/)
  })

  it('opens the panel on mouseup (not click — see VIDE-91), ignoring other buttons', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<FooterMessage />)
    const teaser = screen.getByTestId('notification-teaser')
    fireEvent.mouseUp(teaser, { button: 2 })
    expect(useNotificationPanelStore.getState().open).toBe(false)
    fireEvent.mouseUp(teaser, { button: 0 })
    expect(useNotificationPanelStore.getState().open).toBe(true)
  })

  it('shows the newly arrived notification, with a count of the others', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<FooterMessage />)
    act(() => {
      vi.advanceTimersByTime(TEASER_MS)
    })
    act(() => {
      useDockerSettingsStore.setState({ enabled: true })
      useDockerStore.setState({ status: 'stopped' })
    })
    const teaser = screen.getByTestId('notification-teaser')
    expect(teaser.textContent).toMatch(/Docker isn't running/)
    expect(teaser.textContent).toMatch(/\+1/)
  })

  it('ends early once the notification is acknowledged', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<FooterMessage />)
    act(() => {
      useNotificationAcknowledgedStore.getState().acknowledge(['usage-session'])
    })
    expect(screen.queryByTestId('notification-teaser')).toBeNull()
  })

  it('is silent about Docker when disabled in settings, even if stopped', () => {
    useDockerSettingsStore.setState({ enabled: false })
    useDockerStore.setState({ status: 'stopped' })
    render(<FooterMessage />)
    expect(screen.queryByText("Docker isn't running")).toBeNull()
  })
})

describe('FooterMessage — up to date confirmation', () => {
  it('shows the up-to-date confirmation, bypassing the notification panel entirely', () => {
    useUpdateStore.setState({ upToDateVersion: '0.2.11' })
    render(<FooterMessage />)
    expect(screen.getByText("You're on the latest version — v0.2.11")).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
