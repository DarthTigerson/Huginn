import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { NotificationPeek, PEEK_MS } from '../NotificationPeek'
import { useUsageAlertStore } from '@/stores/usageAlertStore'
import { useUpdateStore } from '@/stores/updateStore'
import { useDockerSettingsStore } from '@/stores/dockerSettingsStore'
import { useDockerStore } from '@/stores/dockerStore'
import { useEditorStore } from '@/stores/editorStore'
import { useNotificationPanelStore } from '@/stores/notificationPanelStore'
import { useNotificationAcknowledgedStore } from '@/stores/notificationAcknowledgedStore'
import { useNotificationArrivalStore } from '@/stores/notificationArrivalStore'
import { USAGE_GRAPH_TAB_PATH } from '@/components/Settings/paths'

function resetStores() {
  useUsageAlertStore.setState({ alerts: [] })
  useUpdateStore.setState({ available: null, status: 'idle', upToDateVersion: null })
  useDockerSettingsStore.setState({ enabled: false })
  useDockerStore.setState({ status: 'unknown' })
  useEditorStore.setState({ activeTabPath: null })
  useNotificationPanelStore.setState({ open: false })
  useNotificationAcknowledgedStore.setState({ acknowledgedIds: [] })
  useNotificationArrivalStore.setState({ knownIds: [], arrival: null })
}

beforeEach(() => {
  resetStores()
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  resetStores()
})

const sessionAlert = () => ({ scope: 'session' as const, cutoffAt: Date.now() + 3_600_000, resetAt: null })
const dockerOff = () => {
  useDockerSettingsStore.setState({ enabled: true })
  useDockerStore.setState({ status: 'stopped' })
}

describe('NotificationPeek', () => {
  it('shows nothing when no notification has arrived', () => {
    render(<NotificationPeek />)
    expect(screen.queryByTestId('notification-peek')).toBeNull()
  })

  it('peeks the new notification above the bell, full width only', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<NotificationPeek />)
    const peek = screen.getByTestId('notification-peek')
    expect(peek.textContent).toMatch(/Session usage may run out/)
    expect(peek.className).toMatch(/hidden min-\[1200px\]:block/)
    expect(peek.className).toMatch(/bottom-full right-0/)
  })

  it('closes by itself without acknowledging, so the bell stays unread', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<NotificationPeek />)
    act(() => {
      vi.advanceTimersByTime(PEEK_MS)
    })
    // fading out
    expect(screen.getByTestId('notification-peek').className).toMatch(/opacity-0/)
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.queryByTestId('notification-peek')).toBeNull()
    expect(useNotificationAcknowledgedStore.getState().acknowledgedIds).toEqual([])
  })

  it('stays open while hovered, and closes once the pointer leaves after its time is up', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<NotificationPeek />)
    fireEvent.mouseEnter(screen.getByTestId('notification-peek'))
    act(() => {
      vi.advanceTimersByTime(PEEK_MS + 1000)
    })
    expect(screen.getByTestId('notification-peek').className).toMatch(/opacity-100/)
    fireEvent.mouseLeave(screen.getByTestId('notification-peek'))
    expect(screen.queryByTestId('notification-peek')).toBeNull()
  })

  it('clicking the row runs its action and acknowledges it (VIDE-91: on mouseup)', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<NotificationPeek />)
    fireEvent.mouseUp(screen.getByText(/Session usage may run out/), { button: 0 })
    expect(useEditorStore.getState().activeTabPath).toBe(USAGE_GRAPH_TAB_PATH)
    expect(useNotificationAcknowledgedStore.getState().acknowledgedIds).toContain('usage-session')
    expect(screen.queryByTestId('notification-peek')).toBeNull()
  })

  it('offers "+N more" when others are active, which opens the full panel', () => {
    dockerOff()
    render(<NotificationPeek />)
    act(() => {
      vi.advanceTimersByTime(PEEK_MS + 200)
    })
    act(() => {
      useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    })
    expect(screen.getByTestId('notification-peek').textContent).toMatch(/Session usage may run out/)
    fireEvent.mouseUp(screen.getByRole('button', { name: '+1 more' }), { button: 0 })
    expect(useNotificationPanelStore.getState().open).toBe(true)
    expect(screen.queryByTestId('notification-peek')).toBeNull()
  })

  it('stays hidden while the full panel is open', () => {
    useNotificationPanelStore.setState({ open: true })
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    render(<NotificationPeek />)
    expect(screen.queryByTestId('notification-peek')).toBeNull()
  })
})
