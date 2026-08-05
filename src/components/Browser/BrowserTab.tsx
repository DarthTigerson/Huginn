import { useEffect, useRef, useState } from 'react'
import { useBrowserStore } from '@/stores/browserStore'
import { useBrowserSettingsStore } from '@/stores/browserSettingsStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildBrowserPath } from '@/components/Settings/paths'
import { normalizeUrlInput } from './urlBar'

interface Props {
  browserId: string
}

// Module-level set tracks which browser ids already have a live WebContentsView
// in the main process, so remounts (pane moves, tab switches) reattach/show
// instead of recreating and losing navigation/session state — same pattern
// TerminalTab.tsx uses for PTYs, adapted for a main-process-owned view instead
// of a DOM node.
const liveBrowserViews = new Set<string>()

function boundsEqual(a: DOMRect, b: DOMRect | null): boolean {
  return !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

export function BrowserTab({ browserId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editingRef = useRef(false)
  const tabState = useBrowserStore((s) => s.tabs[browserId])
  const [urlDraft, setUrlDraft] = useState(tabState?.url || useBrowserSettingsStore.getState().defaultUrl)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    useBrowserStore.getState().ensureTab(browserId, useBrowserSettingsStore.getState().defaultUrl)

    let cancelled = false
    const isNew = !liveBrowserViews.has(browserId)
    liveBrowserViews.add(browserId)

    if (isNew) {
      const initialUrl =
        useBrowserStore.getState().tabs[browserId]?.url || useBrowserSettingsStore.getState().defaultUrl
      window.api.browserViewCreate(browserId, initialUrl).then((webContentsId) => {
        if (cancelled || webContentsId == null) return
        useBrowserStore.getState().updateTab(browserId, { webContentsId })
      })
    } else {
      window.api.browserViewSetVisible(browserId, true)
    }

    const cleanupEvent = window.api.onBrowserViewEvent((id, event) => {
      if (id !== browserId) return
      switch (event.type) {
        case 'did-start-loading':
          useBrowserStore.getState().updateTab(browserId, { isLoading: true, loadError: null })
          break
        case 'did-stop-loading':
          useBrowserStore.getState().updateTab(browserId, {
            isLoading: false,
            canGoBack: event.canGoBack,
            canGoForward: event.canGoForward,
          })
          break
        case 'did-navigate':
        case 'did-navigate-in-page':
          useBrowserStore.getState().updateTab(browserId, {
            url: event.url,
            canGoBack: event.canGoBack,
            canGoForward: event.canGoForward,
          })
          if (!editingRef.current) setUrlDraft(event.url)
          break
        case 'page-title-updated':
          useBrowserStore.getState().updateTab(browserId, { title: event.title })
          break
        case 'did-fail-load':
          useBrowserStore.getState().updateTab(browserId, {
            isLoading: false,
            loadError: event.errorDescription || 'This page could not be loaded.',
          })
          break
        case 'dom-ready':
          useBrowserStore.getState().updateTab(browserId, { webContentsId: event.webContentsId })
          break
      }
    })

    // WebContentsView is a native layer composited above the window's DOM
    // content, not a DOM node itself — its bounds have to be measured and
    // pushed over IPC instead of just living in the flex layout. Polling via
    // rAF (rather than a ResizeObserver on this element) catches reflows that
    // only move the pane — sidebar toggle, split-divider drag — without
    // changing this element's own size, which a ResizeObserver would miss.
    let lastRect: DOMRect | null = null
    let rafId: number
    const syncBounds = () => {
      const rect = container.getBoundingClientRect()
      if (!boundsEqual(rect, lastRect)) {
        lastRect = rect
        if (rect.width > 0 && rect.height > 0) {
          window.api.browserViewSetBounds(browserId, {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          })
        }
      }
      rafId = requestAnimationFrame(syncBounds)
    }
    rafId = requestAnimationFrame(syncBounds)

    return () => {
      cancelled = true
      cleanupEvent()
      cancelAnimationFrame(rafId)

      const tabPath = buildBrowserPath(browserId)
      const stillOpen = useEditorStore.getState().tabs.some((t) => t.path === tabPath)
      if (!stillOpen) {
        liveBrowserViews.delete(browserId)
        useBrowserStore.getState().removeTab(browserId)
        window.api.browserViewDestroy(browserId)
      } else {
        // Leave the guest alive in the main process, just detached from view,
        // so the next mount (e.g. pane move) can show it with session intact.
        window.api.browserViewSetVisible(browserId, false)
      }
    }
  }, [browserId])

  const loadError = tabState?.loadError ?? null

  // The native view always draws on top of this component's own DOM (including
  // the inline "page couldn't load" state below), so it has to be explicitly
  // hidden while that error overlay is what should be visible.
  useEffect(() => {
    window.api.browserViewSetVisible(browserId, !loadError)
  }, [browserId, loadError])

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = normalizeUrlInput(urlDraft)
    if (!url) return
    window.api.browserViewNavigate(browserId, url)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const defaultUrl = useBrowserSettingsStore((s) => s.defaultUrl)
  const url = tabState?.url ?? defaultUrl
  const isLoading = tabState?.isLoading ?? false
  const canGoBack = tabState?.canGoBack ?? false
  const canGoForward = tabState?.canGoForward ?? false

  useEffect(() => {
    if (!editingRef.current) setUrlDraft(url)
  }, [url])

  return (
    <div className="h-full w-full flex flex-col bg-bg overflow-hidden">
      <div className="flex items-center gap-1 px-2 h-9 border-b border-border shrink-0 bg-tab-bar">
        <button
          type="button"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={() => window.api.browserViewGoBack(browserId)}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
          <NavArrowIcon direction="back" />
        </button>
        <button
          type="button"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={() => window.api.browserViewGoForward(browserId)}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
          <NavArrowIcon direction="forward" />
        </button>
        <button
          type="button"
          aria-label="Reload"
          onClick={() => window.api.browserViewReload(browserId)}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5"
        >
          <ReloadIcon spinning={isLoading} />
        </button>
        <form onSubmit={handleUrlSubmit} className="flex-1 min-w-0">
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onFocus={() => { editingRef.current = true }}
            onBlur={() => { editingRef.current = false; setUrlDraft(url) }}
            spellCheck={false}
            placeholder="Search or enter address"
            className="w-full h-6 rounded bg-bg border border-border px-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/60"
          />
        </form>
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="h-full w-full" />
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg px-4 text-center">
            <p className="text-sm text-fg-muted">This page couldn't load</p>
            <p className="max-w-sm text-xs text-fg-subtle">{loadError}</p>
            <button
              type="button"
              onClick={() => window.api.browserViewReload(browserId)}
              className="mt-1 rounded border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg hover:bg-white/5"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NavArrowIcon({ direction }: { direction: 'back' | 'forward' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {direction === 'back' ? (
        <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      ) : (
        <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      )}
    </svg>
  )
}

function ReloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={spinning ? 'animate-spin' : ''}
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
