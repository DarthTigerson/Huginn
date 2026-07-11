import { useState } from 'react'
import type { FileNode } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'

const EXT_COLOR: Record<string, string> = {
  ts: 'text-blue-400', tsx: 'text-blue-400',
  js: 'text-yellow-400', jsx: 'text-yellow-400',
  css: 'text-purple-400', scss: 'text-purple-400',
  html: 'text-orange-400',
  json: 'text-yellow-300',
  md: 'text-gray-400',
  py: 'text-green-400',
  rs: 'text-orange-500',
  go: 'text-cyan-400',
}

function fileColor(name: string): string {
  const ext = name.split('.').pop() ?? ''
  return EXT_COLOR[ext] ?? 'text-gray-300'
}

interface FileTreeProps {
  nodes: FileNode[]
  depth?: number
}

export function FileTree({ nodes, depth = 0 }: FileTreeProps) {
  const { selectedPath, select, expandDir } = useFileStore()
  const { openTab } = useEditorStore()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function handleClick(node: FileNode) {
    if (node.isDirectory) {
      const isOpen = expanded[node.path]
      if (!isOpen && node.children === undefined) {
        await expandDir(node.path)
      }
      setExpanded((prev) => ({ ...prev, [node.path]: !prev[node.path] }))
    } else {
      select(node.path)
      const content = await window.api.readFile(node.path)
      openTab({ path: node.path, content, dirty: false })
    }
  }

  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.path}>
          <button
            className={`flex items-center gap-1 w-full text-left py-0.5 text-sm hover:bg-white/5 rounded truncate ${
              selectedPath === node.path ? 'bg-accent/20 text-white' : 'text-gray-300'
            }`}
            style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }}
            onClick={() => handleClick(node)}
          >
            <span className="shrink-0 text-xs w-3 text-gray-500">
              {node.isDirectory
                ? expanded[node.path]
                  ? '▾'
                  : '▸'
                : ''}
            </span>
            <span className={node.isDirectory ? 'text-gray-200' : fileColor(node.name)}>
              {node.name}
            </span>
          </button>
          {node.isDirectory && expanded[node.path] && node.children && (
            <FileTree nodes={node.children} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}
