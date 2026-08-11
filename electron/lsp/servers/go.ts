import { resolveAndRunStreamed, resolveBinaryPath, resolveVersion } from '../shellPath'
import type { LspServerModule } from '../types'

export const goServer: LspServerModule = {
  id: 'go',
  label: 'Go',
  monacoLanguageIds: ['go'],
  ramEstimate: 'typically 300–800MB on large modules',

  async detect() {
    const path = await resolveBinaryPath('gopls')
    if (!path) return { found: false }
    const version = await resolveVersion(path, ['version'])
    return { found: true, path, version: version ?? undefined }
  },

  async getSpawn() {
    const path = await resolveBinaryPath('gopls')
    if (!path) return null
    return { command: path, args: [] }
  },

  install(onData) {
    return resolveAndRunStreamed('go', ['install', 'golang.org/x/tools/gopls@latest'], onData)
  },
}
