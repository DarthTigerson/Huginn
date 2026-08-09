import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PhoneIcon } from '@/components/ActivityBar/ActivityBar'

describe('PhoneIcon', () => {
  it('renders an svg', () => {
    const { container } = render(<PhoneIcon />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
