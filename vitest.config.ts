import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/test-setup.ts'],
    include: [
      'src/stores/__tests__/**/*.test.ts',
      'src/components/**/__tests__/**/*.test.ts',
      'electron/__tests__/**/*.test.ts'
    ]
  }
})
