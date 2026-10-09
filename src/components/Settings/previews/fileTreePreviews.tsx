import { useGeneralSettingsStore } from '@/stores/generalSettingsStore'
import { toDecoration } from '@/lib/gitTreeStatus'
import type { GitFileEntry } from '@/types/index'
import { PreviewFrame } from './primitives'

// Live picture for Settings › File Tree (VIDE-145), using the tree's own
// letters and colours (gitTreeStatus.ts).

const ROWS: { name: string; depth: number; code?: GitFileEntry['status']; folder?: boolean }[] = [
  { name: 'src', depth: 0, code: 'M', folder: true },
  { name: 'App.tsx', depth: 1, code: 'M' },
  { name: 'gitChangeColors.ts', depth: 1, code: 'A' },
  { name: 'scratch.md', depth: 1, code: '?' },
  { name: 'main.tsx', depth: 1 },
]

export function FileTreePreview() {
  const mode = useGeneralSettingsStore((s) => s.fileTreeGitStatus)
  return (
    <PreviewFrame testId="file-tree-preview">
      <div className="py-1.5">
        {ROWS.map((row) => {
          const deco = row.code ? toDecoration(row.code) : null
          const colour = deco && mode === 'letterAndColour' ? deco.textClass : 'text-fg'
          return (
            <div key={row.name} className="flex items-center gap-1.5 py-0.5 pr-2.5 text-[11px]" style={{ paddingLeft: 10 + row.depth * 12 }}>
              <span className="text-fg-subtle">{row.folder ? '▾' : ''}</span>
              <span className={['min-w-0 flex-1 truncate', colour].join(' ')}>{row.name}</span>
              {deco && mode !== 'off' && !row.folder && <span className={['text-[10px] font-semibold', deco.textClass].join(' ')}>{deco.letter}</span>}
              {deco && mode === 'letterAndColour' && row.folder && <span className={['h-1.5 w-1.5 rounded-full bg-current', deco.textClass].join(' ')} />}
            </div>
          )
        })}
      </div>
    </PreviewFrame>
  )
}
