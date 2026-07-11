export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

export interface Tab {
  path: string
  content: string
  dirty: boolean
}
