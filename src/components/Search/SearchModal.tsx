import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import type { SearchMatch } from '@/types/index'

interface Props {
  projectRoot: string
  onClose: () => void
}

function basename(p: string): string {
  return p.split('/').pop() ?? p
}

function relativePath(root: string, p: string): string {
  return p.startsWith(root + '/') ? p.slice(root.length + 1) : p
}

function searchContent(content: string, path: string, query: string, caseSensitive: boolean): SearchMatch[] {
  const needle = caseSensitive ? query : query.toLowerCase()
  const lines = content.split('\n')
  const results: SearchMatch[] = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const haystack = caseSensitive ? raw : raw.toLowerCase()
    const col = haystack.indexOf(needle)
    if (col !== -1) results.push({ path, line: i + 1, col: col + 1, text: raw })
  }
  return results
}

function HighlightedText({ text, query, caseSensitive }: { text: string; query: string; caseSensitive: boolean }) {
  const needle = caseSensitive ? query : query.toLowerCase()
  const haystack = caseSensitive ? text : text.toLowerCase()
  const idx = haystack.indexOf(needle)
  if (idx === -1) return <span className="text-fg-subtle font-mono text-xs">{text.trim()}</span>

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + query.length)
  const after = text.slice(idx + query.length)

  return (
    <span className="text-fg-subtle font-mono text-xs">
      {before.trimStart()}
      <mark className="bg-accent/40 text-fg rounded-sm not-italic">{match}</mark>
      {after}
    </span>
  )
}

interface FileGroup {
  path: string
  matches: SearchMatch[]
  startIndex: number
  isCurrent: boolean
}

export function SearchModal({ projectRoot, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [otherResults, setOtherResults] = useState<SearchMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tabs = useEditorStore((s) => s.tabs)
  const activePaneId = useEditorStore((s) => s.activePaneId)
  const paneTabs = useEditorStore((s) => s.paneTabs)
  const openTab = useEditorStore((s) => s.openTab)
  const setRevealRequest = useEditorStore((s) => s.setRevealRequest)

  const activeTabPath = paneTabs[activePaneId] ?? null
  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null

  const currentFileMatches = useMemo<SearchMatch[]>(() => {
    if (!activeTab || !query.trim()) return []
    return searchContent(activeTab.content, activeTab.path, query, caseSensitive)
  }, [activeTab?.path, activeTab?.content, query, caseSensitive])

  const allItems = useMemo<SearchMatch[]>(() => {
    return [...currentFileMatches, ...otherResults]
  }, [currentFileMatches, otherResults])

  const fileGroups = useMemo<FileGroup[]>(() => {
    const map = new Map<string, FileGroup>()
    let idx = 0
    for (const match of allItems) {
      if (!map.has(match.path)) {
        map.set(match.path, { path: match.path, matches: [], startIndex: idx, isCurrent: match.path === activeTabPath })
      }
      map.get(match.path)!.matches.push(match)
      idx++
    }
    return Array.from(map.values())
  }, [allItems, activeTabPath])

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setOtherResults([]); setSearching(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const matches = await window.api.searchText(projectRoot, query, caseSensitive)
      setOtherResults(matches.filter((m) => m.path !== activeTabPath))
      setSearching(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, caseSensitive, projectRoot, activeTabPath])

  useEffect(() => { setActiveIndex(0) }, [query])

  useEffect(() => {
    const el = scrollAreaRef.current?.querySelector(`[data-match-index="${activeIndex}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  async function openResult(match: SearchMatch) {
    const { tabs: currentTabs } = useEditorStore.getState()
    const existingTab = currentTabs.find((t) => t.path === match.path)
    if (existingTab) {
      openTab({ path: existingTab.path, content: existingTab.content, dirty: existingTab.dirty })
    } else {
      const content = await window.api.readFile(match.path)
      openTab({ path: match.path, content, dirty: false })
    }
    setRevealRequest({ path: match.path, line: match.line, col: match.col, searchTerm: query })
    onClose()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = allItems[activeIndex]
      if (selected) openResult(selected)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const hasQuery = query.trim().length > 0
  const totalCount = allItems.length

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-[620px] max-h-[60vh] flex flex-col bg-popover border border-border rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={caseSensitive ? 'Search text (case-sensitive)…' : 'Search text…'}
            className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
          />
          <button
            type="button"
            onClick={() => setCaseSensitive((c) => !c)}
            title={caseSensitive ? 'Case-sensitive — click for case-insensitive' : 'Case-insensitive — click for case-sensitive'}
            aria-pressed={caseSensitive}
            className={[
              'shrink-0 text-xs font-mono px-1.5 py-0.5 rounded border select-none',
              caseSensitive ? 'border-accent text-accent bg-accent/10' : 'border-border text-fg-subtle hover:text-fg',
            ].join(' ')}
          >
            Aa
          </button>
          {query && (
            <button type="button" onClick={() => setQuery('')} className="text-fg-subtle hover:text-fg transition-colors">
              <ClearIcon />
            </button>
          )}
        </div>

        {hasQuery && (searching || totalCount > 0) && (
          <div className="px-4 py-1.5 text-xs text-fg-subtle border-b border-border shrink-0">
            {searching ? 'Searching…' : totalCount >= 1000
              ? '1000+ matches (showing first 1000)'
              : `${totalCount} match${totalCount === 1 ? '' : 'es'} in ${fileGroups.length} file${fileGroups.length === 1 ? '' : 's'}`}
          </div>
        )}

        {hasQuery && fileGroups.length > 0 && (
          <div ref={scrollAreaRef} className="overflow-y-auto flex-1 py-1">
            {fileGroups.map((group, gi) => (
              <div key={group.path}>
                {gi > 0 && fileGroups[gi - 1].isCurrent && !group.isCurrent && (
                  <div className="mx-4 my-1 border-t border-border" />
                )}
                <div className="flex items-center gap-2 px-4 pt-2 pb-1">
                  <span className="text-xs font-semibold text-fg truncate">{basename(group.path)}</span>
                  <span className="text-xs text-fg-subtle truncate flex-1">{relativePath(projectRoot, group.path)}</span>
                  {group.isCurrent && <span className="text-xs text-accent shrink-0">current</span>}
                  <span className="text-xs text-fg-subtle shrink-0">{group.matches.length} match{group.matches.length === 1 ? '' : 'es'}</span>
                </div>
                {group.matches.map((match, mi) => {
                  const flatIdx = group.startIndex + mi
                  const isActive = flatIdx === activeIndex
                  return (
                    <button
                      key={`${match.line}:${match.col}`}
                      type="button"
                      data-match-index={flatIdx}
                      onMouseDown={() => openResult(match)}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      className={[
                        'w-full flex items-baseline gap-3 pl-8 pr-4 py-1 text-left transition-colors',
                        isActive ? 'bg-accent/20' : 'hover:bg-white/5',
                      ].join(' ')}
                    >
                      <span className="shrink-0 text-xs text-fg-subtle w-8 text-right">{match.line}</span>
                      <HighlightedText text={match.text} query={query} caseSensitive={caseSensitive} />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {hasQuery && !searching && totalCount === 0 && (
          <div className="px-4 py-6 text-sm text-fg-subtle text-center">No matches for "{query}"</div>
        )}

        {!hasQuery && (
          <div className="px-4 py-6 text-sm text-fg-subtle text-center">
            {caseSensitive ? 'Case-sensitive search across all files' : 'Case-insensitive search across all files'}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-fg-subtle shrink-0">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
