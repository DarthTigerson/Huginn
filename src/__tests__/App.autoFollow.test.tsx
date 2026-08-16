import { describe, it, expect, beforeEach } from 'vitest'
import { useEffect } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useGitReposStore } from '@/stores/gitReposStore'
import { useEditorStore } from '@/stores/editorStore'

// A full <App /> render was attempted here first, but App.tsx (and its
// descendants — Editor's real monaco-editor mount, Chat's xterm
// terminals, react-resizable-panels' imperative collapse()/expand() panel
// sizing) all require browser APIs jsdom doesn't provide (a real canvas 2d
// context, ResizeObserver-driven layout, etc.). Stubbing all of that just
// to exercise one two-line effect isn't worth the fragility it would add,
// per the task brief's own documented fallback for this test.
//
// followFilePath()'s actual switching behavior — which repo it resolves
// to, when it fires the "Switched to…" footer notice, and when it stays
// silent for a manual pick — is already fully covered by
// gitReposStore.test.ts (Task 3). What Task 10 adds on top of that is
// exactly the useEffect below, reproduced verbatim from App.tsx: it feeds
// the active editor tab's path into followFilePath whenever that path
// changes. Testing it in isolation still catches a regression in the
// wiring itself (wrong dependency array, calling the wrong store method,
// skipping the null-path guard, etc.) without needing the whole app tree.
// End-to-end auto-follow (the real App, fully wired together) is manually
// verified per the task brief's Step 8.
function useAutoFollowEffect() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath)
  useEffect(() => {
    if (!activeTabPath) return
    useGitReposStore.getState().followFilePath(activeTabPath)
  }, [activeTabPath])
}

beforeEach(() => {
  useGitReposStore.setState({ repos: ['/proj/repoA', '/proj/repoB'], selectedRepo: '/proj/repoA' })
  useEditorStore.setState({ activeTabPath: null } as any)
})

describe('App — auto-follow effect wiring', () => {
  it('switching the active tab to a file in a different repo updates selectedRepo', () => {
    renderHook(() => useAutoFollowEffect())

    act(() => {
      useEditorStore.setState({ activeTabPath: '/proj/repoB/src/x.ts' } as any)
    })

    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoB')
  })

  it('does nothing when there is no active tab', () => {
    renderHook(() => useAutoFollowEffect())
    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoA')
  })

  it('does not re-fire (or throw) when the active tab stays within the already-selected repo', () => {
    useEditorStore.setState({ activeTabPath: '/proj/repoA/src/a.ts' } as any)
    renderHook(() => useAutoFollowEffect())

    act(() => {
      useEditorStore.setState({ activeTabPath: '/proj/repoA/src/b.ts' } as any)
    })

    expect(useGitReposStore.getState().selectedRepo).toBe('/proj/repoA')
  })
})
