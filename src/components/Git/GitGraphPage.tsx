import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useGitGraphStore } from '@/stores/gitGraphStore'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import { computeLayout } from './graphLayout'
import type { CommitLayout, RowEdge } from './graphLayout'
import { normalizeRef, formatExactDate, refTone, copyToClipboard } from './commitFormat'
import { CommitContextMenu } from './CommitContextMenu'
import { CommitFileContextMenu } from './CommitFileContextMenu'
import { buildGitCommitDiffPath } from './paths'

const ROW_H = 72
const LANE_W = 40
const LANE_PAD = 24
const DOT_R = 11
const MIN_GRAPH_W = 320

function laneX(lane: number, railWidth: number, laneCount: number): number {
  const visibleLanes = Math.max(1, laneCount)
  const laneSpan = (visibleLanes - 1) * LANE_W
  return (railWidth - laneSpan) / 2 + lane * LANE_W
}

function edgePath(
  edge: RowEdge,
  railWidth: number,
  laneCount: number,
  currentLane: number,
  rowIndex: number
): string {
  const x1 = laneX(edge.fromLane, railWidth, laneCount)
  const x2 = laneX(edge.toLane, railWidth, laneCount)
  const y1 = rowIndex === 0 && edge.fromLane === currentLane ? ROW_H / 2 : 0
  if (x1 === x2) {
    return `M ${x1} ${y1} L ${x2} ${ROW_H}`
  }
  return `M ${x1} ${y1} C ${x1} ${ROW_H * 0.35}, ${x2} ${ROW_H * 0.65}, ${x2} ${
    ROW_H
  }`
}

function formatRelDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function graphWidth(laneCount: number): number {
  return Math.max(MIN_GRAPH_W, Math.max(1, laneCount) * LANE_W + LANE_PAD * 2)
}

function nodeMeta(
  commit: CommitLayout['commit'],
  color: string
): {
  fill: string
  ring: string
  glyph: string | null
  text: string
  glow: number
} {
  if (commit.refs.some((ref) => ref.startsWith('tag: '))) {
    return { fill: '#facc15', ring: '#fde047', glyph: 'T', text: '#1f2937', glow: 0.34 }
  }
  if (commit.parents.length > 1) {
    return { fill: color, ring: '#fb923c', glyph: 'M', text: '#ffffff', glow: 0.28 }
  }
  if (commit.refs.some((ref) => ref.includes('HEAD'))) {
    return { fill: color, ring: '#93c5fd', glyph: 'H', text: '#ffffff', glow: 0.26 }
  }
  if (commit.refs.some((ref) => ref.startsWith('origin/'))) {
    return { fill: color, ring: '#fca5a5', glyph: 'R', text: '#ffffff', glow: 0.22 }
  }
  if (commit.refs.length > 0) {
    return { fill: color, ring: '#86efac', glyph: 'B', text: '#ffffff', glow: 0.22 }
  }
  return { fill: color, ring: 'var(--color-panel)', glyph: null, text: '#ffffff', glow: 0.12 }
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: MouseEvent) {
    e.stopPropagation()
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="shrink-0 text-fg-subtle hover:text-fg transition-colors"
    >
      {copied ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

function GraphRow({ layout, rowIndex, selected, graphRailWidth, graphLaneCount, onClick, onContextMenu }: {
  layout: CommitLayout
  rowIndex: number
  selected: boolean
  graphRailWidth: number
  graphLaneCount: number
  onClick: () => void
  onContextMenu: (event: MouseEvent) => void
}) {
  const { commit, lane, color, edges } = layout
  const svgW = graphRailWidth
  const laneCount = Math.max(graphLaneCount, layout.totalLanes, layout.lane + 1)
  const cx = laneX(lane, svgW, laneCount)
  const isMerge = commit.parents.length > 1
  const meta = nodeMeta(commit, color)
  const refs = commit.refs.slice(0, 3)

  return (
    <button
      type="button"
      style={{
        gridTemplateColumns: `minmax(82px, 0.7fr) ${svgW}px minmax(140px, 1.15fr)`,
        background: selected
          ? `linear-gradient(90deg, transparent 0%, ${color}22 35%, ${color}1c 65%, transparent 100%)`
          : undefined,
      }}
      className={[
        'w-full grid items-center text-left cursor-pointer select-none group transition-colors border-l-2 focus:outline-none focus-visible:bg-white/[0.08] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#2563eb]/70',
        selected
          ? 'border-l-[#2563eb]'
          : 'border-l-transparent hover:bg-white/[0.04]',
      ].join(' ')}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
    >
      <div className="min-w-0 px-4 justify-self-end">
        {refs.length > 0 ? (
          <div className="flex justify-end flex-wrap gap-1">
            {refs.map((ref) => (
              <span
                key={ref}
                className={[
                  'max-w-36 truncate text-[0.5625rem] font-semibold px-1.5 py-0.5 rounded border leading-none',
                  refTone(ref),
                ].join(' ')}
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
        ) : (
          <span className="block text-[0.625rem] text-fg-subtle opacity-0 group-hover:opacity-70">
            {formatRelDate(commit.date)}
          </span>
        )}
      </div>

      <div className="relative justify-self-center" style={{ width: svgW }}>
        <svg width={svgW} height={ROW_H} className="overflow-visible block">
          {Array.from({ length: laneCount }).map((_, i) => (
            <line
              key={`guide-${i}`}
              x1={laneX(i, svgW, laneCount)}
              y1={0}
              x2={laneX(i, svgW, laneCount)}
              y2={ROW_H}
              stroke="var(--color-fg-subtle)"
              strokeWidth={1}
              opacity={0.12}
            />
          ))}
          {edges.map((edge, i) => (
            <path
              key={i}
              d={edgePath(edge, svgW, laneCount, lane, rowIndex)}
              stroke={edge.color}
              strokeWidth={4}
              fill="none"
              opacity={selected ? 1 : 0.86}
              strokeLinecap="round"
            />
          ))}
          <circle
            cx={cx}
            cy={ROW_H / 2}
            r={DOT_R + 9}
            fill={meta.fill}
            opacity={selected ? meta.glow + 0.14 : meta.glow}
          />
          <circle
            cx={cx}
            cy={ROW_H / 2}
            r={DOT_R + 2}
            fill="var(--color-panel)"
            stroke={meta.ring}
            strokeWidth={selected ? 3.5 : 2.5}
          />
          <circle cx={cx} cy={ROW_H / 2} r={DOT_R - 1} fill={meta.fill} />
          {meta.glyph ? (
            <text
              x={cx}
              y={ROW_H / 2 + 3}
              textAnchor="middle"
              className="font-mono font-bold"
              fontSize={9}
              fill={meta.text}
            >
              {meta.glyph}
            </text>
          ) : (
            <circle cx={cx} cy={ROW_H / 2} r={3} fill="white" opacity={0.9} />
          )}
        </svg>
      </div>

      <div className="min-w-0 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-fg truncate flex-1">{commit.subject}</span>
          {isMerge && (
            <span className="shrink-0 text-[0.5625rem] leading-none px-1.5 py-1 rounded border border-[#fb923c]/70 bg-[#fb923c]/20 text-[var(--ref-orange-text)]">
              merge
            </span>
          )}
        </div>
        <div className="mt-1 text-[0.625rem] text-fg-subtle truncate opacity-70">
          {commit.hash.slice(0, 7)} · {formatExactDate(commit.date)}
        </div>
      </div>
    </button>
  )
}

interface FileMenuState {
  x: number
  y: number
  path: string
}

function DetailPanel({ cwd, hash, onClose }: {
  cwd: string
  hash: string
  onClose: () => void
}) {
  const commits = useGitGraphStore((s) => s.commits)
  const selectedFiles = useGitGraphStore((s) => s.selectedFiles)
  const filesLoading = useGitGraphStore((s) => s.filesLoading)
  const loadFiles = useGitGraphStore((s) => s.loadFiles)
  const [fileMenu, setFileMenu] = useState<FileMenuState | null>(null)

  const commit = commits.find((c) => c.hash === hash)

  useEffect(() => {
    loadFiles(cwd, hash)
  }, [hash, cwd, loadFiles])

  function openFileDiff(path: string) {
    useEditorStore.getState().openTab({ path: buildGitCommitDiffPath(hash, path), content: '', dirty: false })
  }

  async function openCurrentFile(path: string) {
    const fullPath = `${cwd}/${path}`
    const content = await window.api.readFile(fullPath)
    useEditorStore.getState().openTab({ path: fullPath, content, dirty: false })
  }

  function handleFileContextMenu(e: MouseEvent, path: string) {
    e.preventDefault()
    e.stopPropagation()
    setFileMenu({ x: e.clientX, y: e.clientY, path })
  }

  if (!commit) return null

  return (
    <>
      <div className="w-80 shrink-0 border-l border-border flex flex-col bg-sidebar overflow-hidden">
        <div className="h-11 flex items-center justify-between px-4 border-b border-border shrink-0">
          <span className="text-[0.625rem] font-semibold text-fg-muted uppercase tracking-wider">
            Commit Details
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-subtle hover:text-fg transition-colors text-xs leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/10"
            aria-label="Close commit details"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          <div className="border border-border bg-panel rounded-md p-3">
            <div className="text-[0.625rem] text-fg-muted uppercase tracking-wider mb-2">
              Selected node
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm text-fg font-medium leading-snug">{commit.subject}</div>
              <CopyButton value={commit.subject} label="message" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[0.625rem]">
              <div className="border border-border rounded px-2 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-fg-subtle uppercase tracking-wider">Hash</span>
                  <CopyButton value={commit.hash} label="hash" />
                </div>
                <div className="font-mono text-fg mt-1 truncate">{commit.hash.slice(0, 12)}</div>
              </div>
              <div className="border border-border rounded px-2 py-1.5">
                <div className="text-fg-subtle uppercase tracking-wider">Parents</div>
                <div className="font-mono text-fg mt-1">{commit.parents.length || 'root'}</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-fg-muted flex flex-col gap-2">
            <div className="flex justify-between gap-3 items-center">
              <span className="text-fg-subtle">Author</span>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-fg truncate text-right">{commit.author}</span>
                <CopyButton value={commit.author} label="author" />
              </span>
            </div>
            <div className="flex justify-between gap-3 items-center">
              <span className="text-fg-subtle">Date</span>
              <span className="flex items-center gap-1.5">
                <span className="text-fg text-right">{formatExactDate(commit.date)}</span>
                <CopyButton value={formatExactDate(commit.date)} label="date" />
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-fg-subtle">Relative</span>
              <span className="text-fg text-right">{formatRelDate(commit.date)}</span>
            </div>
          </div>

          {commit.refs.length > 0 && (
            <div>
              <div className="text-[0.625rem] font-semibold text-fg-muted uppercase tracking-wider mb-2">
                References
              </div>
              <div className="flex flex-wrap gap-1">
                {commit.refs.map((ref) => (
                  <span
                    key={ref}
                    className={`max-w-full truncate text-[0.5625rem] font-semibold px-1.5 py-0.5 rounded border leading-none ${refTone(ref)}`}
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[0.625rem] font-semibold text-fg-muted uppercase tracking-wider mb-2">
              Changed Files
            </div>
            {filesLoading ? (
              <div className="text-xs text-fg-subtle">Loading…</div>
            ) : selectedFiles.length === 0 ? (
              <div className="text-xs text-fg-subtle">No files</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {selectedFiles.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => openFileDiff(f)}
                    onContextMenu={(e) => handleFileContextMenu(e, f)}
                    className="w-full flex items-center gap-2 py-0.5 text-left rounded hover:bg-white/5 transition-colors"
                  >
                    <span className="text-[0.6875rem] font-mono text-fg truncate opacity-80">{f}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {fileMenu && (
        <CommitFileContextMenu
          x={fileMenu.x}
          y={fileMenu.y}
          onCopyPath={() => copyToClipboard(fileMenu.path)}
          onOpenFile={() => openCurrentFile(fileMenu.path)}
          onOpenDiff={() => openFileDiff(fileMenu.path)}
          onClose={() => setFileMenu(null)}
        />
      )}
    </>
  )
}

interface RowMenuState {
  x: number
  y: number
  message: string
  hash: string
}

export function GitGraphPage() {
  const commits = useGitGraphStore((s) => s.commits)
  const selectedHash = useGitGraphStore((s) => s.selectedHash)
  const loading = useGitGraphStore((s) => s.loading)
  const load = useGitGraphStore((s) => s.load)
  const select = useGitGraphStore((s) => s.select)
  const projectRoot = useFileStore((s) => s.projectRoot)
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null)

  useEffect(() => {
    if (projectRoot) load(projectRoot)
  }, [projectRoot, load])

  const layouts = computeLayout(commits)
  const graphLaneCount = layouts.reduce(
    (count, layout) => Math.max(count, layout.totalLanes, layout.lane + 1),
    1
  )
  const graphRailWidth = graphWidth(graphLaneCount)

  const handleSelect = useCallback((hash: string) => {
    select(selectedHash === hash ? null : hash)
  }, [selectedHash, select])

  function handleRowContextMenu(event: MouseEvent, message: string, hash: string) {
    event.preventDefault()
    setRowMenu({ x: event.clientX, y: event.clientY, message, hash })
  }

  return (
    <div className="h-full flex overflow-hidden bg-panel">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-11 px-4 border-b border-border shrink-0 flex items-center justify-between">
          <span className="text-[0.625rem] font-semibold text-fg-muted uppercase tracking-wider">
            Git Graph
          </span>
          {loading ? (
            <span className="text-[0.625rem] text-fg-subtle">Loading…</span>
          ) : (
            <button
              type="button"
              onClick={() => projectRoot && load(projectRoot)}
              className="text-[0.625rem] text-fg-muted hover:text-fg transition-colors"
            >
              Refresh
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && commits.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-fg-subtle">
              Loading history…
            </div>
          ) : layouts.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-fg-subtle">
              No commits found
            </div>
          ) : (
            layouts.map((layout, index) => (
              <GraphRow
                key={layout.commit.hash}
                layout={layout}
                rowIndex={index}
                graphRailWidth={graphRailWidth}
                graphLaneCount={graphLaneCount}
                selected={layout.commit.hash === selectedHash}
                onClick={() => handleSelect(layout.commit.hash)}
                onContextMenu={(e) => handleRowContextMenu(e, layout.commit.subject, layout.commit.hash)}
              />
            ))
          )}
        </div>
      </div>

      {selectedHash && projectRoot && (
        <DetailPanel
          cwd={projectRoot}
          hash={selectedHash}
          onClose={() => select(null)}
        />
      )}

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
