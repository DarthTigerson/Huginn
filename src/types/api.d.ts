import type { FileNode } from './index'

declare global {
  interface Window {
    api: {
      readDir: (path: string) => Promise<FileNode[]>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, content: string) => Promise<void>
      openFolder: () => Promise<string | null>

      termSpawn: () => Promise<void>
      termWrite: (data: string) => void
      termResize: (cols: number, rows: number) => void
      onTermData: (cb: (data: string) => void) => () => void
    }
  }
}

export {}
