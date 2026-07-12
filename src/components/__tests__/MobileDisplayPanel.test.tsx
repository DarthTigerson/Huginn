import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileDisplayPanel } from '@/components/MobileDisplay/MobileDisplayPanel'

describe('MobileDisplayPanel', () => {
  it('renders the panel header', () => {
    render(<MobileDisplayPanel />)
    expect(screen.getByText('Mobile Display')).toBeTruthy()
  })
})
