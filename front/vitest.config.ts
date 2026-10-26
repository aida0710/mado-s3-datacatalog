import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // api/shared のスキーマが import する zod も front の 1 つに寄せる (2 つあると別物として扱われる)。
  resolve: { dedupe: ['zod'] },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
})
