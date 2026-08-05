import { useEffect, useRef, useState } from 'react'
import type { WebviewTag } from 'electron'
import { useBrowserStore } from '@/stores/browserStore'
import { useBrowserSettingsStore } from '@/stores/browserSettingsStore'
import { useEditorStore } from '@/stores/editorStore'
import { buildBrowserPath } from '@/components/Settings/paths'
import { normalizeUrlInput } from './urlBar'

interface Props {
  browserId: string
}

// Module-level map keeps <webview> elements (and their loaded page/session)
// alive across React remounts, same pattern TerminalTab.tsx uses for PTYs.
const liveBrowserTabs = new Map<string, WebviewTag>()

export function BrowserTab({ browserId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const webviewRef = useRef<WebviewTag | null>(null)
  const editingRef = useRef(false)
  const tabState = useBrowserStore((s) => s.tabs[browserId])
  const [urlDraft, setUrlDraft] = useState(tabState?.url || useBrowserSettingsStore.getState().defaultUrl)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    useBrowserStore.getState().ensureTab(browserId, useBrowserSettingsStore.getState().defaultUrl)

    let webview = liveBrowserTabs.get(browserId)

    if (webview) {
      // Reattach existing webview to the new container — preserves navigation/session
      container.innerHTML = ''
      container.appendChild(webview)
    } else {
      webview = document.createElement('webview') as unknown as WebviewTag
      // <webview> defaults to display:inline like any unstyled custom element —
      // width/height:100% are no-ops without this, so the guest view never gets a box.
      webview.style.display = 'block'
      webview.style.width = '100%'
      webview.style.height = '100%'
      webview.src = useBrowserStore.getState().tabs[browserId]?.url || useBrowserSettingsStore.getState().defaultUrl
      container.innerHTML = ''
      container.appendChild(webview)
      liveBrowserTabs.set(browserId, webview)

      const live = webview

      live.addEventListener('did-start-loading', () => {
        useBrowserStore.getState().updateTab(browserId, { isLoading: true, loadError: null })
      })
      live.addEventListener('did-stop-loading', () => {
        useBrowserStore.getState().updateTab(browserId, {
          isLoading: false,
          canGoBack: live.canGoBack(),
          canGoForward: live.canGoForward(),
        })
      })
      live.addEventListener('did-navigate', (e) => {
        useBrowserStore.getState().updateTab(browserId, {
          url: e.url,
          canGoBack: live.canGoBack(),
          canGoForward: live.canGoForward(),
        })
        if (!editingRef.current) setUrlDraft(e.url)
      })
      live.addEventListener('did-navigate-in-page', (e) => {
        useBrowserStore.getState().updateTab(browserId, {
          url: e.url,
          canGoBack: live.canGoBack(),
          canGoForward: live.canGoForward(),
        })
        if (!editingRef.current) setUrlDraft(e.url)
      })
      live.addEventListener('page-title-updated', (e) => {
        useBrowserStore.getState().updateTab(browserId, { title: e.title })
      })
      live.addEventListener('did-fail-load', (e) => {
        // -3 is ERR_ABORTED, fired on normal navigation interruption (e.g. redirects) — not a real failure
        if (!e.isMainFrame || e.errorCode === -3) return
        useBrowserStore.getState().updateTab(browserId, {
          isLoading: false,
          loadError: e.errorDescription || 'This page could not be loaded.',
        })
      })
      live.addEventListener('dom-ready', () => {
        useBrowserStore.getState().updateTab(browserId, { webContentsId: live.getWebContentsId() })
      })
    }

    webviewRef.current = webview

    // <webview>'s internal compositor surface doesn't reliably track a
    // percentage-based CSS box across flex layout passes (it can get stuck at
    // whatever size it saw on attach, leaving the bottom of the page unpainted).
    // Measuring the container and pushing explicit pixel dimensions, the same
    // way TerminalTab.tsx does for cols/rows, forces it to stay in sync.
    const currentWebview = webview
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return
      currentWebview.style.width = `${width}px`
      currentWebview.style.height = `${height}px`
    })
    observer.observe(container)

    return () => {
      observer.disconnect()

      const tabPath = buildBrowserPath(browserId)
      const stillOpen = useEditorStore.getState().tabs.some((t) => t.path === tabPath)
      if (!stillOpen) {
        liveBrowserTabs.delete(browserId)
        useBrowserStore.getState().removeTab(browserId)
        webview?.remove()
      }
      // Otherwise: leave the webview detached but alive in liveBrowserTabs so
      // the next mount (e.g. pane move) can reattach it with page/session intact
    }
  }, [browserId])

  function navigate(url: string) {
    webviewRef.current?.loadURL(url)
  }

  function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = normalizeUrlInput(urlDraft)
    if (!url) return
    navigate(url)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  const defaultUrl = useBrowserSettingsStore((s) => s.defaultUrl)
  const url = tabState?.url ?? defaultUrl
  const isLoading = tabState?.isLoading ?? false
  const canGoBack = tabState?.canGoBack ?? false
  const canGoForward = tabState?.canGoForward ?? false
  const loadError = tabState?.loadError ?? null

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
          onClick={() => webviewRef.current?.goBack()}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
          <NavArrowIcon direction="back" />
        </button>
        <button
          type="button"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={() => webviewRef.current?.goForward()}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
          <NavArrowIcon direction="forward" />
        </button>
        <button
          type="button"
          aria-label="Reload"
          onClick={() => webviewRef.current?.reload()}
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
              onClick={() => webviewRef.current?.reload()}
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
