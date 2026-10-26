import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'

// 分離したAPIのフィクスチャに合わせ、アプリの開発用のポートを避ける。
const API_URL = 'http://127.0.0.1:4329'
const WEB_PORT = 6329
const frontRoot = fileURLToPath(new URL('../', import.meta.url))
const server = await createServer({
  root: frontRoot,
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
  server: {
    host: '127.0.0.1', port: WEB_PORT, strictPort: true,
    proxy: { '/api/internal': API_URL, '/api/auth': API_URL, '/verification': API_URL },
  },
})
await server.listen()
console.log(`Access-token verification Web: http://127.0.0.1:${WEB_PORT}`)
