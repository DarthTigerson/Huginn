import { useEffect, useCallback } from 'react'
import { useGitGraphStore } from '@/stores/gitGraphStore'
import { useFileStore } from '@/stores/fileStore'
import { computeLayout } from './graphLayout'
import type { CommitLayout, RowEdge } from './graphLayout'

const ROW_H = 28
const LANE_W = 16
const DOT_R = 4

function laneX(lane: number): number {
  return lane * LANE_W + LANE_W / 2
}

function edgePath(edge: RowEdge): string {
  const x1 = laneX(edge.fromLane)
  const x2 = laneX(edge.toLane)
  if (x1 === x2) {
    return `M ${x1} 0 L ${x2} ${ROW_H}`
  }
  return `M ${x1} 0 C ${x1} ${ROW_H * 0.4}, ${x2} ${ROW_H * 0.6}, ${x2} ${ROW_H}`
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

function resolveColor(color: string): string {
  return color
}

function GraphRow({ layout, selected, onClick }: {
  layout: CommitLayout
  selected: boolean
  onClick: () => void
}) {
  const { commit, lane, color, totalLanes, edges } = layout
  const svgW = Math.max(totalLanes, lane + 1) * LANE_W + LANE_W
  const cx = laneX(lane)
  const shortHash = commit.hash.slice(0, 7)
  const relDate = formatRelDate(commit.date)

  return (
    <div
      className={[
        'flex items-center h-7 cursor-pointer select-none group transition-colors',
        selected ? 'bg-accent/15' : 'hover:bg-white/5',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="shrink-0" style={{ width: svgW }}>
        <svg width={svgW} height={ROW_H} className="overflow-visible block">
          {edges.map((edge, i) => (
            <path
              key={i}
              d={edgePath(edge)}
              stroke={resolveColor(edge.color)}
              strokeWidth={1.5}
              fill="none"
              opacity={0.75}
            />
          ))}
          <circle
            cx={cx}
            cy={ROW_H / 2}
            r={DOT_R}
            fill={resolveColor(color)}
            stroke="var(--color-panel)"
            strokeWidth={1.5}
          />
        </svg>
      </div>

      <div className="flex-1 flex items-center gap-2 px-2 min-w-0">
        {commit.refs.map((ref) => (
          <span
            key={ref}
            className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/20 text-accent leading-none"
          >
            {ref.replace('HEAD -> ', '').replace('tag: ', '')}
          </span>
        ))}
        <span className="text-xs text-fg truncate flex-1">{commit.subject}</span>
        <span className="shrink-0 text-[10px] text-fg-muted font-mono">{shortHash}</span>
        <span className="shrink-0 text-[10px] text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity">
          {relDate}
        </span>
      </div>
    </div>
  )
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

  const commit = commits.find((c) => c.hash === hash)

  useEffect(() => {
    loadFiles(cwd, hash)
  }, [hash, cwd, loadFiles])

  if (!commit) return null

  return (
    <div className="w-72 shrink-0 border-l border-border flex flex-col bg-sidebar overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider">
          Commit
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-fg-subtle hover:text-fg transition-colors text-xs leading-none w-5 h-5 flex items-center justify-center rounded hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div>
          <div className="font-mono text-xs text-accent mb-1 tracking-wide">
            {commit.hash.slice(0, 12)}
          </div>
          <div className="text-sm text-fg font-medium leading-snug">{commit.subject}</div>
        </div>

        <div className="text-xs text-fg-muted flex flex-col gap-1">
          <div>{commit.author}</div>
          <div>{new Date(commit.date).toLocaleString()}</div>
        </div>

        {commit.refs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {commit.refs.map((ref) => (
              <span
                key={ref}
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/20 text-accent leading-none"
              >
                {ref}
              </span>
            ))}
          </div>
        )}

        <div>
          <div className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider mb-2">
            Changed Files
          </div>
          {filesLoading ? (
            <div className="text-xs text-fg-subtle">Loading…</div>
          ) : selectedFiles.length === 0 ? (
            <div className="text-xs text-fg-subtle">No files</div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {selectedFiles.map((f) => (
                <div key={f} className="text-[11px] font-mono text-fg truncate py-0.5 opacity-80">
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function GitGraphPage() {
  const commits = useGitGraphStore((s) => s.commits)
  const selectedHash = useGitGraphStore((s) => s.selectedHash)
  const loading = useGitGraphStore((s) => s.loading)
  const load = useGitGraphStore((s) => s.load)
  const select = useGitGraphStore((s) => s.select)
  const projectRoot = useFileStore((s) => s.projectRoot)

  useEffect(() => {
    if (projectRoot) load(projectRoot)
  }, [projectRoot, load])

  const layouts = computeLayout(commits)

  const handleSelect = useCallback((hash: string) => {
    select(selectedHash === hash ? null : hash)
  }, [selectedHash, select])

  return (
    <div className="h-full flex overflow-hidden bg-panel">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-fg-muted uppercase tracking-wider">
            Git Graph
          </span>
          {loading ? (
            <span className="text-[10px] text-fg-subtle">Loading…</span>
          ) : (
            <button
              type="button"
              onClick={() => projectRoot && load(projectRoot)}
              className="text-[10px] text-fg-muted hover:text-fg transition-colors"
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
            layouts.map((layout) => (
              <GraphRow
                key={layout.commit.hash}
                layout={layout}
                selected={layout.commit.hash === selectedHash}
                onClick={() => handleSelect(layout.commit.hash)}
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
    </div>
  )
}
