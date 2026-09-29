import type * as Monaco from 'monaco-editor'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { GitBlameLine } from '@/types/index'
import { getFileBlame } from '@/lib/gitBlame'
import { formatRelDate, formatExactDate } from '@/components/Git/commitFormat'
import { buildLiveToHeadLineMap, type LineOrigin } from '@/lib/blameLineMap'
import { useFooterBlameStore, type FooterBlame } from '@/stores/footerBlameStore'
import type { BlameDisplayMode } from '@/stores/editorSettingsStore'
import { BlameDetailsPanel } from '@/components/Git/BlameDetailsPanel'

// Current-line git-blame annotation, shown only for the cursor's line and updated as it moves (GitLens-style).
// Blame is keyed by HEAD line numbers; buildLiveToHeadLineMap (blameLineMap.ts) remaps them since uncommitted edits shift lines apart.
//
// Rendered via a content widget (editor.addContentWidget), not a decoration's `after` text: InjectedText/`after`
// decorations never painted to the DOM in this app's embedded Monaco build (verified live - decorations.set()
// reports success with real content, but zero DOM elements with the target class ever exist, on a build where
// the installed and CDN-loaded monaco-editor versions match and the decoration shape matches Monaco's own
// types). Content widgets are the same mechanism inlineEditMonaco.ts already relies on, and do render correctly.

const WIDGET_ID = 'vide.currentLineBlame'
// Roughly the hover panel's height: a cursor line closer than this to the top
// of the editor opens the panel downward so it isn't cut off.
const PANEL_FLIP_THRESHOLD_PX = 90

function buildBlameIndex(lines: GitBlameLine[]): Map<number, GitBlameLine> {
  const index = new Map<number, GitBlameLine>()
  for (const line of lines) index.set(line.line, line)
  return index
}

// Same shape for both display modes. The summary is never cut here - the
// footer and the in-editor text each truncate to their own width in CSS.
function toLineBlame(line: GitBlameLine): FooterBlame {
  const iso = new Date(line.authorTime * 1000).toISOString()
  return {
    kind: 'commit',
    author: line.author,
    summary: line.summary || '(no commit message)',
    date: formatExactDate(iso),
    relDate: formatRelDate(iso),
  }
}

export interface CurrentLineBlameOptions {
  repoRoot: string
  relPath: string
  // Where the blame is shown (Settings > Git > Blame); defaults to 'editor'.
  display?: BlameDisplayMode
}

export interface CurrentLineBlameHandle {
  // Re-fetches blame and the HEAD blob, bypassing the cache.
  refresh: () => void
  // Tears down this mount's widget and any in-flight/pending work.
  dispose: () => void
}

export function attachCurrentLineBlame(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  { repoRoot, relPath, display = 'editor' }: CurrentLineBlameOptions
): CurrentLineBlameHandle {
  let cancelled = false
  let headContent: string | null = null
  let blameByHeadLine: Map<number, GitBlameLine> | null = null
  let lineOriginMap: Map<number, LineOrigin> | null = null

  // In-editor look matches the footer: accent author + " • message" (no time),
  // with BlameDetailsPanel on hover. The panel lives outside the truncating
  // text span so it isn't clipped, and is a React root since it's shared JSX.
  const domNode = document.createElement('span')
  domNode.className = 'git-blame-annotation group relative'
  const textEl = document.createElement('span')
  textEl.dataset.blameText = ''
  textEl.className = 'inline-block max-w-[50ch] truncate align-bottom'
  const authorEl = document.createElement('span')
  authorEl.dataset.blameAuthor = ''
  authorEl.className = 'text-accent'
  const restEl = document.createTextNode('')
  textEl.append(authorEl, restEl)
  const panelHost = document.createElement('span')
  domNode.append(textEl, panelHost)
  let panelRoot: Root | null = null
  let widgetLine = 1
  let widgetColumn = 1
  let widgetVisible = false

  const widget: Monaco.editor.IContentWidget = {
    getId: () => WIDGET_ID,
    getDomNode: () => domNode,
    getPosition: () =>
      widgetVisible
        ? {
            position: { lineNumber: widgetLine, column: widgetColumn },
            preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
          }
        : null,
    // Lets the hover panel spill past the editor's edges instead of being clipped.
    allowEditorOverflow: true,
  }
  if (display === 'editor') editor.addContentWidget(widget)

  // Footer mode: only the focused pane writes to the footer, so split panes
  // don't fight over it. This mount's own object is its owner token.
  const footerOwner = {}
  function publishToFooter(blame: FooterBlame | null) {
    const store = useFooterBlameStore.getState()
    if (editor.hasTextFocus()) store.publish(footerOwner, blame)
    else if (!blame) store.release(footerOwner)
  }

  function renderPanel(blame: FooterBlame, line: number, column: number) {
    panelRoot ??= createRoot(panelHost)
    const root = panelRoot
    if (blame.kind !== 'commit') {
      flushSync(() => root.render(null))
      return
    }
    const top = editor.getScrolledVisiblePosition({ lineNumber: line, column })?.top ?? Infinity
    const placement = top < PANEL_FLIP_THRESHOLD_PX ? 'below' : 'above'
    flushSync(() => root.render(createElement(BlameDetailsPanel, { ...blame, placement })))
  }

  function show(line: number, column: number, blame: FooterBlame) {
    if (display === 'footer') {
      publishToFooter(blame)
      return
    }
    if (blame.kind === 'commit') {
      authorEl.textContent = blame.author
      restEl.textContent = ` • ${blame.summary}`
    } else {
      authorEl.textContent = ''
      restEl.textContent = 'Uncommitted change'
    }
    renderPanel(blame, line, column)
    widgetLine = line
    widgetColumn = column
    widgetVisible = true
    editor.layoutContentWidget(widget)
  }

  function hide() {
    if (display === 'footer') {
      publishToFooter(null)
      return
    }
    if (!widgetVisible) return
    widgetVisible = false
    editor.layoutContentWidget(widget)
  }

  function render(selection: Monaco.Selection | null) {
    if (cancelled || !selection) return
    const model = editor.getModel()
    if (!model) return
    // Triple-click/Cmd+L "select whole line" reports as spanning into the next line at column 1 - treat that as single-line too.
    const touchesNextLineOnly = selection.endColumn === 1 && selection.endLineNumber === selection.startLineNumber + 1
    const isSingleLine = selection.startLineNumber === selection.endLineNumber || touchesNextLineOnly
    if (!isSingleLine || !lineOriginMap || !blameByHeadLine) {
      hide()
      return
    }
    // A line-spanning selection has no real content on its second line, so use startLineNumber instead of the caret's positionLineNumber.
    const line = touchesNextLineOnly ? selection.startLineNumber : selection.positionLineNumber
    const origin = lineOriginMap.get(line)
    if (!origin) {
      hide()
      return
    }
    const col = model.getLineMaxColumn(line)
    if (origin.kind === 'uncommitted') {
      show(line, col, { kind: 'uncommitted' })
      return
    }
    const blameLine = blameByHeadLine.get(origin.headLine)
    if (!blameLine) {
      hide()
      return
    }
    show(line, col, toLineBlame(blameLine))
  }

  async function loadAll(force: boolean) {
    try {
      const [blame, head] = await Promise.all([
        getFileBlame(repoRoot, relPath, { force }),
        window.api.gitFileAtHead(repoRoot, relPath),
      ])
      if (cancelled) return
      blameByHeadLine = buildBlameIndex(blame.lines)
      headContent = head
      const model = editor.getModel()
      lineOriginMap = model ? buildLiveToHeadLineMap(headContent, model.getValue()) : new Map()
      render(editor.getSelection())
    } catch (error) {
      // Log rather than fail silently - otherwise the symptom is just "no blame ever shows up", with no clue why.
      if (!cancelled) console.error('[currentLineBlame] failed to load blame', error)
    }
  }

  // Recomputed synchronously (it's a cheap in-memory diff, not the git shell-out that loadAll debounces/caches)
  // so a cursor-selection event immediately after an edit never renders against a pre-edit map - see blame-mismap
  // bug where a debounced recompute left stale blame showing on the wrong line for a moment after typing.
  editor.onDidChangeModelContent(() => {
    const model = editor.getModel()
    lineOriginMap = model && headContent !== null ? buildLiveToHeadLineMap(headContent, model.getValue()) : null
    render(editor.getSelection())
  })

  editor.onDidChangeCursorSelection((e) => render(e.selection))

  // Clicking into another pane hands the footer over to that pane's blame.
  if (display === 'footer') editor.onDidFocusEditorText(() => render(editor.getSelection()))

  loadAll(false)

  return {
    refresh: () => loadAll(true),
    dispose: () => {
      cancelled = true
      if (display === 'editor') {
        editor.removeContentWidget(widget)
        panelRoot?.unmount()
      } else useFooterBlameStore.getState().release(footerOwner)
    },
  }
}
