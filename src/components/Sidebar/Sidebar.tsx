import { useFileStore } from '@/stores/fileStore'
import { FileTree } from './FileTree'

export function Sidebar() {
  const { projectRoot, tree, openFolder } = useFileStore()

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border overflow-hidden">
      {projectRoot ? (
        <>
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider truncate border-b border-border shrink-0">
            {projectRoot.split('/').pop()}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <FileTree nodes={tree} />
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-xs text-gray-500 text-center">No folder open</p>
          <button
            onClick={openFolder}
            className="px-3 py-1.5 text-sm bg-accent hover:bg-blue-500 text-white rounded transition-colors"
          >
            Open Folder
          </button>
        </div>
      )}
    </div>
  )
}
