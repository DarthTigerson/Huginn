import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Modal } from '../Modal'

describe('Modal', () => {
  it('portals its content to document.body instead of rendering inline in its parent', () => {
    const { container } = render(
      <div className="bg-sidebar">
        <Modal onClose={() => {}}>
          <p>Discard All Changes</p>
        </Modal>
      </div>
    )

    // Regression: rendered as a DOM descendant of a bg-sidebar/bg-panel
    // ancestor, the `fixed inset-0` overlay gets trapped inside that
    // ancestor's containing block under the "glossy" panel style
    // (backdrop-filter creates one) - same root cause as the BranchPalette
    // and context-menu bugs. Portaling to document.body sidesteps it.
    expect(container.querySelector('.bg-sidebar')?.contains(screen.getByText('Discard All Changes'))).toBe(false)
    expect(document.body.contains(screen.getByText('Discard All Changes'))).toBe(true)
  })
})
