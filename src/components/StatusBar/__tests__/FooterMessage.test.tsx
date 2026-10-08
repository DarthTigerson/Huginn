import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FooterMessage } from '../FooterMessage'
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
  useNotificationAcknowledgedStore.setState({ acknowledgedIds: [], dismissedIds: [] })
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

describe('FooterMessage — new notifications stay out of the center', () => {
  it('renders nothing in the center when a notification arrives (it peeks above the bell instead)', () => {
    useUsageAlertStore.setState({ alerts: [sessionAlert()] })
    const { container } = render(<FooterMessage />)
    expect(container).toBeEmptyDOMElement()
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
