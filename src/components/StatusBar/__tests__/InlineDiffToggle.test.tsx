/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { InlineDiffToggle } from '../InlineDiffToggle'
import { useEditorSettingsStore } from '@/stores/editorSettingsStore'
import { useGitReposStore } from '@/stores/gitReposStore'

beforeEach(() => {
  useEditorSettingsStore.setState({ inlineDiffEnabled: true, inlineDiffFooterIcon: true })
  useGitReposStore.setState({ repos: ['/p'] })
})

afterEach(cleanup)

describe('InlineDiffToggle', () => {
  it('flips the inline diff setting on click', () => {
    render(<InlineDiffToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Inline diff highlight on' }))
    expect(useEditorSettingsStore.getState().inlineDiffEnabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Inline diff highlight off' })).toBeInTheDocument()
  })

  it('is hidden when the project has no git repo', () => {
    useGitReposStore.setState({ repos: [] })
    render(<InlineDiffToggle />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('is hidden when Show icon in footer is off', () => {
    useEditorSettingsStore.setState({ inlineDiffFooterIcon: false })
    render(<InlineDiffToggle />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
