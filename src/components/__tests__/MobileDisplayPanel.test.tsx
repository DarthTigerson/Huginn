import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileDisplayPanel } from '@/components/MobileDisplay/MobileDisplayPanel'
import type { MobileState } from '@/types/api'

const defaultState: MobileState = {
  running: false,
  port: 7842,
  localIp: '127.0.0.1',
  pin: '',
  qrSvg: '',
  connectedCount: 0,
}

beforeEach(() => {
  Object.defineProperty(window, 'api', {
    value: {
      mobileGetState: vi.fn().mockResolvedValue(defaultState),
      mobileStart: vi.fn().mockResolvedValue(undefined),
      mobileStop: vi.fn().mockResolvedValue(undefined),
      onMobileState: vi.fn().mockReturnValue(() => {}),
    },
    writable: true,
    configurable: true,
  })
})

describe('MobileDisplayPanel', () => {
  it('renders the panel header', () => {
    render(<MobileDisplayPanel />)
    expect(screen.getByText('Mobile Display')).toBeTruthy()
  })

  it('shows the toggle', () => {
    render(<MobileDisplayPanel />)
    expect(screen.getByLabelText('Start mobile server')).toBeTruthy()
  })

  it('shows off-state prompt when not running', () => {
    render(<MobileDisplayPanel />)
    expect(screen.getByText(/Turn on to start/)).toBeTruthy()
  })
})
