import { resolveAndRunStreamed, resolveBinaryPath, resolveVersion } from '../shellPath'
import type { LspServerModule } from '../types'

export const pythonServer: LspServerModule = {
  id: 'python',
  label: 'Python',
  monacoLanguageIds: ['python'],
  ramEstimate: 'typically 200–500MB, scales with project size',

  async detect() {
    const path = await resolveBinaryPath('pyright-langserver')
    if (!path) return { found: false }
    const version = await resolveVersion(path, ['--version'])
    return { found: true, path, version: version ?? undefined }
  },

  async getSpawn() {
    const path = await resolveBinaryPath('pyright-langserver')
    if (!path) return null
    return { command: path, args: ['--stdio'] }
  },

  install(onData) {
    return resolveAndRunStreamed('npm', ['install', '-g', 'pyright'], onData)
  },
}
