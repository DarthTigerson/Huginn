import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useFileStore } from '@/stores/fileStore'
import { useGitStore } from '@/stores/gitStore'
import { useGitSettingsStore } from '@/stores/gitSettingsStore'
import type { GitCommit } from '@/types/index'
import { normalizeRef, formatExactDate, refTone } from './commitFormat'
import { CommitContextMenu } from './CommitContextMenu'
import { CommitDetailsPanel } from './CommitDetailsPanel'

const ROW_H = 70

function chooseTarget(
  branches: string[],
  source: string,
  defaultBranch: string | null,
  configuredTarget?: string
): string {
  // A user-configured default (Settings > Git > List Diff) wins outright.
  // Otherwise the repo's actual default branch (resolved via origin/HEAD)
  // comes next — it's the correct answer, not a guess. `main`/`master` stay
  // as a fallback for repos with no origin remote or an unset origin/HEAD.
  const preferred = [
    configuredTarget,
    defaultBranch,
    `origin/${source}`,
    'origin/main',
    'origin/master',
    'main',
    'master',
  ]
    .filter((branch): branch is string => !!branch)
    .find((branch) => branch !== source && branches.includes(branch))

  return preferred ?? branches.find((branch) => branch !== source) ?? ''
}

function branchTone(branch: string): string {
  if (branch.startsWith('origin/')) return 'border-[#dc2626]/50 bg-[#dc2626]/10 text-[var(--ref-red-text)]'
  if (branch === 'main' || branch === 'master') {
    return 'border-[#2563eb]/60 bg-[#2563eb]/15 text-[var(--ref-blue-text)]'
  }
  return 'border-[#16a34a]/50 bg-[#16a34a]/10 text-[var(--ref-green-text)]'
}

function BranchCombobox({ label, value, options, onChange }: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((branch) => branch.toLowerCase().includes(needle))
  }, [options, query])

  function selectBranch(branch: string) {
    onChange(branch)
    setQuery('')
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-0">
      <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className={[
          'w-full h-9 rounded border px-2.5 text-left flex items-center justify-between gap-2 transition-colors',
          open
            ? 'border-[#2563eb]/70 bg-[#2563eb]/10'
            : 'border-border bg-bg hover:border-fg-subtle',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 flex items-center gap-2">
          <span className={['shrink-0 h-2 w-2 rounded-full border', branchTone(value)].join(' ')} />
          <span className="truncate text-xs text-fg">{value || 'Select branch'}</span>
        </span>
        <span className="shrink-0 text-[0.625rem] text-fg-subtle">{open ? '^' : 'v'}</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border border-border bg-popover shadow-2xl shadow-black/40">
          <div className="border-b border-border p-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search branches"
              className="w-full h-8 rounded border border-border bg-bg px-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-[#2563eb]/70"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                }
              }}
            />
          </div>
          <div role="listbox" className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-fg-subtle">No branches found</div>
            ) : (
              filtered.map((branch) => (
                <button
                  key={branch}
                  type="button"
                  role="option"
                  aria-selected={branch === value}
                  onClick={() => selectBranch(branch)}
                  className={[
                    'w-full min-w-0 rounded px-2 py-2 text-left flex items-center gap-2 transition-colors',
                    branch === value ? 'bg-[#2563eb]/18 text-fg' : 'hover:bg-white/[0.06] text-fg-muted',
                  ].join(' ')}
                >
                  <span className={['shrink-0 h-2 w-2 rounded-full border', branchTone(branch)].join(' ')} />
                  <span className="min-w-0 flex-1 truncate text-xs">{branch}</span>
                  {branch === value && (
                    <span className="shrink-0 text-[0.625rem] text-[var(--ref-blue-text)]">selected</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CommitRow({ commit, index, total, selected, onClick, onContextMenu }: {
  commit: GitCommit
  index: number
  total: number
  selected: boolean
  onClick: () => void
  onContextMenu: (event: MouseEvent) => void
}) {
  const refs = commit.refs.slice(0, 3)
  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <button
      type="button"
      style={{
        gridTemplateColumns: 'minmax(82px, 0.35fr) 90px minmax(180px, 1.5fr)',
        background: selected
          ? 'linear-gradient(90deg, transparent 0%, #2563eb22 35%, #2563eb1c 65%, transparent 100%)'
          : undefined,
        minHeight: ROW_H,
      }}
      className={[
        'w-full grid items-center text-left group transition-colors border-l-2 focus:outline-none focus-visible:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#2563eb]/70',
        selected ? 'border-l-[#2563eb]' : 'border-l-transparent hover:bg-white/[0.04]',
      ].join(' ')}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
    >
      <div className="min-w-0 px-4 justify-self-end">
        {refs.length > 0 && (
          <div className="flex justify-end flex-wrap gap-1">
            {refs.map((ref) => (
              <span
                key={ref}
                className={`max-w-36 truncate text-[0.5625rem] font-semibold px-1.5 py-0.5 rounded border leading-none ${refTone(ref)}`}
              >
                {normalizeRef(ref)}
              </span>
            ))}
            {commit.refs.length > refs.length && (
              <span className="text-[0.5625rem] px-1.5 py-0.5 rounded border border-border text-fg-muted leading-none">
                +{commit.refs.length - refs.length}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative h-full flex items-center justify-center">
        {!isFirst && (
          <span className="absolute top-0 h-1/2 w-1 rounded-b bg-[#2563eb]" />
        )}
        {!isLast && (
          <span className="absolute bottom-0 h-1/2 w-1 rounded-t bg-[#2563eb]" />
        )}
        <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#1e293b] ring-2 ring-[#60a5fa] shadow-[0_0_0_8px_rgba(37,99,235,0.18)]">
          <span className="h-3.5 w-3.5 rounded-full bg-[#2563eb] ring-2 ring-white/80" />
        </span>
      </div>

      <div className="min-w-0 px-4 py-2">
        <div className="text-xs text-fg truncate">{commit.subject}</div>
        <div className="mt-1 text-[0.625rem] text-fg-subtle truncate">
          {commit.hash.slice(0, 7)} | {commit.author} | {formatExactDate(commit.date)}
        </div>
      </div>
    </button>
  )
}

interface RowMenuState {
  x: number
  y: number
  message: string
  hash: string
}

export function GitBranchDiffPage() {
  const projectRoot = useFileStore((s) => s.projectRoot)
  const currentBranch = useGitStore((s) => s.branch)
  const getListDiffTargetBranch = useGitSettingsStore((s) => s.getListDiffTargetBranch)
  const configuredTarget = projectRoot ? getListDiffTargetBranch(projectRoot) : ''
  const [branches, setBranches] = useState<string[]>([])
  const [defaultBranch, setDefaultBranch] = useState<string | null>(null)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [loadingCommits, setLoadingCommits] = useState(false)
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)
  const [selectedHash, setSelectedHash] = useState<string | null>(null)

  useEffect(() => {
    if (!projectRoot) return

    let cancelled = false
    setLoadingBranches(true)

    Promise.all([
      window.api.gitBranches(projectRoot),
      currentBranch ? Promise.resolve(currentBranch) : window.api.gitBranch(projectRoot),
      window.api.gitDefaultBranch(projectRoot),
    ]).then(([loadedBranches, branch, loadedDefaultBranch]) => {
      if (cancelled) return
      const selectedSource = branch ?? loadedBranches[0] ?? ''
      const uniqueBranches = Array.from(
        new Set(selectedSource ? [selectedSource, ...loadedBranches] : loadedBranches)
      )
      setBranches(uniqueBranches)
      setDefaultBranch(loadedDefaultBranch)
      setSource((existing) => existing || selectedSource)
      setTarget((existing) => existing || chooseTarget(uniqueBranches, selectedSource, loadedDefaultBranch, configuredTarget))
      setLoadingBranches(false)
    })

    return () => {
      cancelled = true
    }
  }, [projectRoot, currentBranch])

  useEffect(() => {
    setSelectedHash(null)

    if (!projectRoot || !source || !target || source === target) {
      setCommits([])
      return
    }

    let cancelled = false
    setLoadingCommits(true)
    window.api.gitBranchDiff(projectRoot, source, target).then((result) => {
      if (cancelled) return
      setCommits(result.commits)
      setLoadingCommits(false)
    })

    return () => {
      cancelled = true
    }
  }, [projectRoot, source, target])

  const selectedCommit = commits.find((c) => c.hash === selectedHash) ?? null

  const targetOptions = useMemo(
    () => branches.filter((branch) => branch !== source),
    [branches, source]
  )

  function handleSourceChange(nextSource: string) {
    setSource(nextSource)
    if (!target || target === nextSource) {
      setTarget(chooseTarget(branches, nextSource, defaultBranch, configuredTarget))
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-panel">
      <div className="h-11 px-4 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-[0.625rem] font-semibold text-fg-muted uppercase tracking-wider">
          Branch Diff
        </span>
        <span className="text-[0.625rem] text-fg-subtle">
          {loadingBranches || loadingCommits ? 'Loading...' : `${commits.length} commits`}
        </span>
      </div>

      <div className="border-b border-border px-4 py-3 shrink-0">
        <div className="grid grid-cols-[minmax(160px,1fr)_48px_minmax(160px,1fr)] items-end gap-3 max-w-3xl mx-auto">
          <BranchCombobox
            label="Source branch"
            value={source}
            options={branches}
            onChange={handleSourceChange}
          />

          <div className="h-8 flex items-center justify-center text-[var(--ref-blue-text)] text-xs font-bold">
            vs
          </div>

          <BranchCombobox
            label="Target branch"
            value={target}
            options={targetOptions}
            onChange={setTarget}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {loadingBranches || loadingCommits ? (
            <div className="flex items-center justify-center h-32 text-sm text-fg-subtle">
              Loading branch diff...
            </div>
          ) : !source || !target ? (
            <div className="flex items-center justify-center h-32 text-sm text-fg-subtle">
              Select two branches
            </div>
          ) : commits.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-fg-subtle">
              No commits between selected branches
            </div>
          ) : (
            <div>
              {commits.map((commit, index) => (
                <CommitRow
                  key={commit.hash}
                  commit={commit}
                  index={index}
                  total={commits.length}
                  selected={commit.hash === selectedHash}
                  onClick={() => setSelectedHash((h) => (h === commit.hash ? null : commit.hash))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setRowMenu({ x: e.clientX, y: e.clientY, message: commit.subject, hash: commit.hash })
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {selectedCommit && projectRoot && (
          <CommitDetailsPanel
            cwd={projectRoot}
            commit={selectedCommit}
            onClose={() => setSelectedHash(null)}
          />
        )}
      </div>

      {rowMenu && (
        <CommitContextMenu
          x={rowMenu.x}
          y={rowMenu.y}
          message={rowMenu.message}
          hash={rowMenu.hash}
          onClose={() => setRowMenu(null)}
        />
      )}
    </div>
  )
}
