import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // テストのファイルはPostgresの`dashboard_test`というDBを1つ共有する
    // （db/README.mdを参照）ので、本当の意味で並列には走らせられない。
    // beforeEachのTRUNCATEが競合してしまう。
    fileParallelism: false,
  },
})
