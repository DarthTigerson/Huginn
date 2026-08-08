import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AutocompleteIcon } from '@/components/ActivityBar/ActivityBar'

describe('AutocompleteIcon', () => {
  it('renders an svg', () => {
    const { container } = render(<AutocompleteIcon crossedOut={false} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a slash path when crossedOut is true', () => {
    const { container } = render(<AutocompleteIcon crossedOut={true} />)
    expect(container.querySelectorAll('svg path').length).toBe(3)
  })

  it('omits the slash path when crossedOut is false', () => {
    const { container } = render(<AutocompleteIcon crossedOut={false} />)
    expect(container.querySelectorAll('svg path').length).toBe(2)
  })
})
