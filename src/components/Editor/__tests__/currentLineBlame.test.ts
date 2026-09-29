import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { GitBlameLine } from '@/types/index'

vi.mock('@/lib/gitBlame', () => ({
  getFileBlame: vi.fn(),
}))

import { getFileBlame } from '@/lib/gitBlame'
import { attachCurrentLineBlame } from '../currentLineBlame'
import { useFooterBlameStore } from '@/stores/footerBlameStore'

function blameLine(overrides: Partial<GitBlameLine> = {}): GitBlameLine {
  return {
    line: 1,
    hash: 'abcdef1234567890abcdef1234567890abcdef12',
    author: 'Ada Lovelace',
    authorTime: 1700000000,
    summary: 'Initial commit',
    ...overrides,
  }
}

// Minimal stand-in for Monaco.editor.IStandaloneCodeEditor + the monaco
// namespace - only the surface attachCurrentLineBlame actually touches.
// Blame renders via a content widget (see currentLineBlame.ts), so the fake
// editor tracks the single widget it adds/removes rather than decorations.
type FakeSelection = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  positionLineNumber: number
}

function makeFakeEditor(initialContent: string) {
  let content = initialContent
  let selection: FakeSelection = { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1, positionLineNumber: 1 }
  const contentListeners: Array<() => void> = []
  const selectionListeners: Array<(e: { selection: typeof selection }) => void> = []
  const focusListeners: Array<() => void> = []
  let focused = false
  let widget: { getDomNode: () => { textContent: string | null }; getPosition: () => { position: { lineNumber: number; column: number } } | null } | null = null

  const editor = {
    getModel: () => ({
      getValue: () => content,
      getLineMaxColumn: (_line: number) => 999,
    }),
    onDidChangeModelContent: (cb: () => void) => {
      contentListeners.push(cb)
      return { dispose: () => {} }
    },
    onDidChangeCursorSelection: (cb: (e: { selection: typeof selection }) => void) => {
      selectionListeners.push(cb)
      return { dispose: () => {} }
    },
    getSelection: () => selection,
    hasTextFocus: () => focused,
    onDidFocusEditorText: (cb: () => void) => {
      focusListeners.push(cb)
      return { dispose: () => {} }
    },
    addContentWidget: (w: typeof widget) => { widget = w },
    removeContentWidget: (w: typeof widget) => { if (widget === w) widget = null },
    layoutContentWidget: (_w: typeof widget) => {},
  }

  const monaco = {
    editor: { ContentWidgetPositionPreference: { EXACT: 0 } },
  }

  return {
    editor,
    monaco,
    // Reads what's currently shown, the same way Monaco itself would: via
    // the widget's own getPosition()/getDomNode(), not internal state.
    currentAnnotation(): { line: number; text: string } | null {
      if (!widget) return null
      const pos = widget.getPosition()
      if (!pos) return null
      return { line: pos.position.lineNumber, text: widget.getDomNode().textContent ?? '' }
    },
    // Simulates the user clicking into this editor (e.g. switching panes).
    focus() {
      focused = true
      for (const cb of focusListeners) cb()
    },
    blur() {
      focused = false
    },
    // Simulates the user clicking/arrow-keying to a new line with no edit.
    moveCursorTo(line: number) {
      selection = { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1, positionLineNumber: line }
      for (const cb of selectionListeners) cb({ selection })
    },
    // Simulates typing (e.g. Enter): content changes, then Monaco fires the
    // cursor-selection event for the moved caret.
    editContentAndMoveCursorTo(newContent: string, line: number) {
      content = newContent
      for (const cb of contentListeners) cb()
      selection = { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1, positionLineNumber: line }
      for (const cb of selectionListeners) cb({ selection })
    },
    // Simulates dragging a selection across several full lines.
    selectLines(from: number, to: number) {
      selection = { startLineNumber: from, startColumn: 1, endLineNumber: to, endColumn: 5, positionLineNumber: to }
      for (const cb of selectionListeners) cb({ selection })
    },
    // Simulates a triple-click / "select line" drag: Monaco reports this as
    // spanning into the *next* line at column 1, even though nothing on
    // that next line is actually selected.
    selectWholeLine(line: number) {
      selection = {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line + 1,
        endColumn: 1,
        positionLineNumber: line + 1,
      }
      for (const cb of selectionListeners) cb({ selection })
    },
  }
}

describe('attachCurrentLineBlame', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(global as any).window = { api: { gitFileAtHead: vi.fn() } }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders blame for a line reached by a plain click, with no intervening content edit', async () => {
    const headContent = 'line one\nline two\nline three\n'
    const fake = makeFakeEditor(headContent)
    ;(getFileBlame as any).mockResolvedValue({
      headCommit: 'deadbeef',
      lines: [
        blameLine({ line: 1, author: 'Ada Lovelace' }),
        blameLine({ line: 2, author: 'Grace Hopper' }),
        blameLine({ line: 3, author: 'Margaret Hamilton' }),
      ],
    })
    ;(window.api.gitFileAtHead as any).mockResolvedValue(headContent)

    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt' })

    // Let the initial loadAll() promise chain resolve.
    await vi.runAllTimersAsync()

    fake.moveCursorTo(2)

    const shown = fake.currentAnnotation()
    expect(shown).not.toBeNull()
    expect(shown!.line).toBe(2)
    expect(shown!.text).toContain('Grace Hopper')
  })

  it('keeps rendering correctly across several consecutive clicks', async () => {
    const headContent = 'line one\nline two\nline three\n'
    const fake = makeFakeEditor(headContent)
    ;(getFileBlame as any).mockResolvedValue({
      headCommit: 'deadbeef',
      lines: [
        blameLine({ line: 1, author: 'Ada Lovelace' }),
        blameLine({ line: 2, author: 'Grace Hopper' }),
        blameLine({ line: 3, author: 'Margaret Hamilton' }),
      ],
    })
    ;(window.api.gitFileAtHead as any).mockResolvedValue(headContent)

    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt' })
    await vi.runAllTimersAsync()

    for (const [line, author] of [[3, 'Margaret Hamilton'], [1, 'Ada Lovelace'], [2, 'Grace Hopper']] as const) {
      fake.moveCursorTo(line)
      const shown = fake.currentAnnotation()
      expect(shown!.line).toBe(line)
      expect(shown!.text).toContain(author)
    }
  })

  it('still shows blame for the source line when the selection spans into the next line at column 1 (triple-click "select line")', async () => {
    const headContent = 'line one\nline two\nline three\n'
    const fake = makeFakeEditor(headContent)
    ;(getFileBlame as any).mockResolvedValue({
      headCommit: 'deadbeef',
      lines: [
        blameLine({ line: 1, author: 'Ada Lovelace' }),
        blameLine({ line: 2, author: 'Grace Hopper' }),
        blameLine({ line: 3, author: 'Margaret Hamilton' }),
      ],
    })
    ;(window.api.gitFileAtHead as any).mockResolvedValue(headContent)

    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt' })
    await vi.runAllTimersAsync()

    fake.selectWholeLine(2)

    const shown = fake.currentAnnotation()
    expect(shown!.line).toBe(2)
    expect(shown!.text).toContain('Grace Hopper')
  })
})

describe('attachCurrentLineBlame — footer mode', () => {
  const headContent = 'line one\nline two\nline three\n'

  beforeEach(() => {
    vi.useFakeTimers()
    ;(global as any).window = { api: { gitFileAtHead: vi.fn() } }
    useFooterBlameStore.setState({ blame: null, owner: null })
    ;(getFileBlame as any).mockResolvedValue({
      headCommit: 'deadbeef',
      lines: [
        blameLine({ line: 1, author: 'Ada Lovelace' }),
        blameLine({ line: 2, author: 'Grace Hopper', summary: 'Teach the compiler' }),
        blameLine({ line: 3, author: 'Margaret Hamilton' }),
      ],
    })
    ;(window.api.gitFileAtHead as any).mockResolvedValue(headContent)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sends the focused editor\'s current-line blame to the footer instead of drawing it in the editor', async () => {
    const fake = makeFakeEditor(headContent)
    fake.focus()
    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()

    fake.moveCursorTo(2)

    expect(fake.currentAnnotation()).toBeNull()
    expect(useFooterBlameStore.getState().blame).toMatchObject({
      kind: 'commit',
      author: 'Grace Hopper',
      summary: 'Teach the compiler',
    })
  })

  it('sends the full commit message to the footer, not the editor\'s shortened one', async () => {
    const longSummary = 'A'.repeat(120)
    ;(getFileBlame as any).mockResolvedValue({
      headCommit: 'deadbeef',
      lines: [blameLine({ line: 1, summary: longSummary })],
    })
    const fake = makeFakeEditor(headContent)
    fake.focus()
    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()

    fake.moveCursorTo(1)

    expect(useFooterBlameStore.getState().blame).toMatchObject({ summary: longSummary })
  })

  it('reports an uncommitted line to the footer as uncommitted', async () => {
    const fake = makeFakeEditor(headContent)
    fake.focus()
    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()

    fake.editContentAndMoveCursorTo('brand new line\n' + headContent, 1)

    expect(useFooterBlameStore.getState().blame).toEqual({ kind: 'uncommitted' })
  })

  it('ignores cursor moves in an editor that does not have focus', async () => {
    const fake = makeFakeEditor(headContent)
    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()

    fake.moveCursorTo(2)

    expect(useFooterBlameStore.getState().blame).toBeNull()
  })

  it('switches the footer to another pane when that pane gains focus', async () => {
    const left = makeFakeEditor(headContent)
    const right = makeFakeEditor(headContent)
    left.focus()
    attachCurrentLineBlame(left.editor as any, left.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    attachCurrentLineBlame(right.editor as any, right.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()
    left.moveCursorTo(1)
    right.moveCursorTo(3)
    expect(useFooterBlameStore.getState().blame).toMatchObject({ author: 'Ada Lovelace' })

    left.blur()
    right.focus()

    expect(useFooterBlameStore.getState().blame).toMatchObject({ author: 'Margaret Hamilton' })
  })

  it('clears the footer when a multi-line selection has no single blame', async () => {
    const fake = makeFakeEditor(headContent)
    fake.focus()
    attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()
    fake.moveCursorTo(2)

    fake.selectLines(1, 3)

    expect(useFooterBlameStore.getState().blame).toBeNull()
  })

  it('clears the footer when the editor is disposed', async () => {
    const fake = makeFakeEditor(headContent)
    fake.focus()
    const handle = attachCurrentLineBlame(fake.editor as any, fake.monaco as any, { repoRoot: '/repo', relPath: 'f.txt', display: 'footer' })
    await vi.runAllTimersAsync()
    fake.moveCursorTo(2)
    expect(useFooterBlameStore.getState().blame).not.toBeNull()

    handle.dispose()

    expect(useFooterBlameStore.getState().blame).toBeNull()
  })
})
