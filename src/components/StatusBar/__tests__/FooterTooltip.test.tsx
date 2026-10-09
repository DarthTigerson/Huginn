/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { FooterTooltip } from '../FooterTooltip'

afterEach(cleanup)

describe('FooterTooltip', () => {
  it('renders its label as a tooltip beside the wrapped control', () => {
    render(<FooterTooltip label="Display settings"><button type="button">13</button></FooterTooltip>)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Display settings')
    expect(screen.getByRole('button', { name: '13' })).toBeInTheDocument()
  })

  it('drops the tooltip while hidden, e.g. when the control has its own menu open', () => {
    render(<FooterTooltip label="Notifications" hidden><button type="button">bell</button></FooterTooltip>)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
