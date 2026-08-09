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

  it('applies the spin animation class to the arc when busy', () => {
    const { container } = render(<AutocompleteIcon crossedOut={false} busy={true} />)
    expect(container.querySelector('.autocomplete-busy-arc')).toBeTruthy()
  })

  it('omits the spin animation class when not busy', () => {
    const { container } = render(<AutocompleteIcon crossedOut={false} busy={false} />)
    expect(container.querySelector('.autocomplete-busy-arc')).toBeFalsy()
  })
})
