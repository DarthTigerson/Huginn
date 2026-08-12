import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useGitLogStore } from '@/stores/gitLogStore'
import { useFontSizeStore } from '@/stores/fontSizeStore'
import { useInstanceFontSizeStore } from '@/stores/instanceFontSizeStore'
import { GIT_LOG_TAB_PATH } from '@/components/Settings/paths'
import { GitLogView } from '../GitLogView'

describe('GitLogView', () => {
  beforeEach(() => {
    useGitLogStore.setState({ text: 'git log output' })
    useFontSizeStore.setState({ fontSize: 13 })
    useInstanceFontSizeStore.setState({ overrides: {} })
  })

  it('renders the git log text at the base font size', () => {
    const { getByText } = render(<GitLogView />)
    expect(getByText('git log output')).toHaveStyle({ fontSize: '13px' })
  })

  it('zooms in on unshifted CmdOrCtrl+= without affecting the global font size', () => {
    const { container, getByText } = render(<GitLogView />)
    const root = container.firstElementChild as HTMLElement

    fireEvent.keyDown(root, { key: '=', metaKey: true })

    expect(useInstanceFontSizeStore.getState().overrides[GIT_LOG_TAB_PATH]).toBe(14)
    expect(useFontSizeStore.getState().fontSize).toBe(13)
    expect(getByText('git log output')).toHaveStyle({ fontSize: '14px' })
  })

  it('zooms out on unshifted CmdOrCtrl+-', () => {
    const { container, getByText } = render(<GitLogView />)
    const root = container.firstElementChild as HTMLElement

    fireEvent.keyDown(root, { key: '-', metaKey: true })

    expect(useInstanceFontSizeStore.getState().overrides[GIT_LOG_TAB_PATH]).toBe(12)
    expect(getByText('git log output')).toHaveStyle({ fontSize: '12px' })
  })

  it('resets on CmdOrCtrl+0', () => {
    const { container, getByText } = render(<GitLogView />)
    const root = container.firstElementChild as HTMLElement

    fireEvent.keyDown(root, { key: '=', metaKey: true })
    fireEvent.keyDown(root, { key: '0', metaKey: true })

    expect(useInstanceFontSizeStore.getState().overrides[GIT_LOG_TAB_PATH]).toBeUndefined()
    expect(getByText('git log output')).toHaveStyle({ fontSize: '13px' })
  })

  it('ignores shifted CmdOrCtrl+Shift+= so it passes through to the global shortcut', () => {
    const { container } = render(<GitLogView />)
    const root = container.firstElementChild as HTMLElement

    fireEvent.keyDown(root, { key: '=', metaKey: true, shiftKey: true })

    expect(useInstanceFontSizeStore.getState().overrides[GIT_LOG_TAB_PATH]).toBeUndefined()
  })
})
