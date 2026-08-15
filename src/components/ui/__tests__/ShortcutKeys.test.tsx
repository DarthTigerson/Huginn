import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShortcutKeys } from '../ShortcutKeys'

describe('ShortcutKeys', () => {
  it('renders a single-chord shortcut as one key chip', () => {
    render(<ShortcutKeys shortcut="⌥⌘↑" />)
    const kbd = screen.getByText('⌥', { exact: false }).closest('kbd')
    expect(kbd).not.toBeNull()
  })

  it('renders a multi-chord shortcut (space-separated) as one chip per chord', () => {
    render(<ShortcutKeys shortcut="⌘K ⌘S" />)
    expect(screen.getAllByText('⌘', { exact: false })).toHaveLength(2)
  })

  it('separates leading modifier glyphs from the key without breaking apart a multi-letter key name', () => {
    render(<ShortcutKeys shortcut="⌥⌘Backspace" />)
    // "Backspace" must stay one intact word, not spaced into individual
    // letters (letter-spacing on the whole string did exactly that).
    expect(screen.getByText('Backspace')).toBeInTheDocument()
  })

  it('handles a shortcut with no modifiers (just a key name)', () => {
    render(<ShortcutKeys shortcut="F2" />)
    expect(screen.getByText('F2')).toBeInTheDocument()
  })

  it('handles a single modifier plus a word key', () => {
    render(<ShortcutKeys shortcut="⇧Enter" />)
    expect(screen.getByText('Enter')).toBeInTheDocument()
    expect(screen.getByText('⇧')).toBeInTheDocument()
  })
})
