import { goServer } from './go'
import { pythonServer } from './python'
import { rustServer } from './rust'
import { typescriptServer } from './typescript'
import type { LspServerId, LspServerModule } from '../types'

export const LSP_SERVERS: Record<LspServerId, LspServerModule> = {
  typescript: typescriptServer,
  python: pythonServer,
  go: goServer,
  rust: rustServer,
}

export function serverForMonacoLanguage(languageId: string): LspServerModule | null {
  return Object.values(LSP_SERVERS).find((s) => s.monacoLanguageIds.includes(languageId)) ?? null
}
