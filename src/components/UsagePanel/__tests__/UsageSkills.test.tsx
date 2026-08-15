import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsageSkills } from '../UsageSkills'

describe('UsageSkills', () => {
  it('shows a "no data yet" message when there are no skills', () => {
    render(<UsageSkills topSkills={[]} />)
    expect(screen.getByText('No data yet')).toBeTruthy()
  })

  it('lists each skill with its name and percentage', () => {
    render(<UsageSkills topSkills={[{ name: 'superpowers:writing-plans', pct: 3 }, { name: 'run', pct: 2 }]} />)

    expect(screen.getByText('superpowers:writing-plans')).toBeTruthy()
    expect(screen.getByText('3%')).toBeTruthy()
    expect(screen.getByText('run')).toBeTruthy()
    expect(screen.getByText('2%')).toBeTruthy()
  })
})
