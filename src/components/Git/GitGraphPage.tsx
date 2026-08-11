import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { useGitGraphStore } from '@/stores/gitGraphStore'
import { useFileStore } from '@/stores/fileStore'
import { computeLayout } from './graphLayout'
import type { CommitLayout, RowEdge } from './graphLayout'
import { normalizeRef, formatExactDate, formatRelDate, refTone } from './commitFormat'
import { CommitContextMenu } from './CommitContextMenu'
import { CommitDetailsPanel } from './CommitDetailsPanel'

const ROW_H = 72
const LANE_W = 40
const LANE_PAD = 24
const DOT_R = 11
// A floor just above what a single lane already needs (LANE_W + LANE_PAD*2
// = 88) — the dot is centered in this column, so any width beyond what the
// lanes actually need becomes dead space on both sides of it. Previously
// 320, which reserved room for ~6 lanes' worth of width even on a plain
// linear (1-lane) history.
const MIN_GRAPH_W = 90

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
        gridTemplateColumns: `minmax(82px, 0.35fr) ${svgW}px minmax(140px, 1.5fr)`,
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

  const selectedCommit = commits.find((c) => c.hash === selectedHash) ?? null

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

      {selectedCommit && projectRoot && (
        <CommitDetailsPanel
          cwd={projectRoot}
          commit={selectedCommit}
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
