import { describe, it, expect } from 'vitest'
import { formatBurnRate, formatCountdown, formatResetTime } from '../format'

describe('formatResetTime', () => {
  it('returns an em dash for no timestamp', () => {
    expect(formatResetTime(null)).toBe('—')
  })

  it('formats a timestamp as "Mon D, H:MM"', () => {
    const ts = new Date(2026, 7, 13, 9, 59).getTime()
    expect(formatResetTime(ts)).toMatch(/Aug 13, 9:59/)
  })
})

describe('formatCountdown', () => {
  const now = new Date(2026, 7, 9, 15, 4).getTime()

  it('returns an em dash for no timestamp', () => {
    expect(formatCountdown(null, now)).toBe('—')
  })

  it('returns "now" once the reset time has passed', () => {
    expect(formatCountdown(now - 1000, now)).toBe('now')
  })

  it('formats hours and minutes remaining', () => {
    const resetAt = now + (3 * 60 + 45) * 60_000
    expect(formatCountdown(resetAt, now)).toBe('3h 45m')
  })

  it('formats minutes only under an hour', () => {
    const resetAt = now + 12 * 60_000
    expect(formatCountdown(resetAt, now)).toBe('12m')
  })
})

describe('formatBurnRate', () => {
  it('returns an em dash for no rate', () => {
    expect(formatBurnRate(null)).toBe('—')
  })

  it('formats a rate to two decimal places with a percent-per-hour suffix', () => {
    expect(formatBurnRate(30.5512)).toBe('≈30.55%/hr')
  })
})
