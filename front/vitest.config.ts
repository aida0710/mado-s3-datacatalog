import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        // @mado/design-system 0.6.0 の dist は相対の import に拡張子が無く (`from './storage'`)、
        // Node の ESM では解決できない。テストでだけ Vite の解決を通す (アプリのコードとビルドは変えない)。
        // デザインシステムが拡張子を付けた版を出したら、この指定を消す。
        inline: ['@mado/design-system'],
      },
    },
  },
})
