import { useState } from 'react'
import type { FileNode } from '@/types/index'
import { useFileStore } from '@/stores/fileStore'
import { useEditorStore } from '@/stores/editorStore'
import { FileIcon, FolderIcon } from './FileIcon'

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
              selectedPath === node.path ? 'bg-accent/20 text-fg' : 'text-fg'
            }`}
            style={{ paddingLeft: `${8 + depth * 12}px`, paddingRight: '8px' }}
            onClick={() => handleClick(node)}
          >
            <span className="shrink-0 text-xs w-3 text-fg-subtle">
              {node.isDirectory
                ? expanded[node.path]
                  ? '▾'
                  : '▸'
                : ''}
            </span>
            {node.isDirectory ? (
              <FolderIcon open={!!expanded[node.path]} />
            ) : (
              <FileIcon name={node.name} />
            )}
            <span className="truncate text-fg">
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
