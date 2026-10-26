// docs/openapi.json をルートの一覧 (api/openapi/route-catalog.ts) から書き出す: cd api && npm run openapi:generate。
// 文書の版はリリースの版 (リポジトリの VERSION) にする。
import { readFile, writeFile } from 'node:fs/promises'
import { buildOpenApiDocument, formatOpenApiDocument } from '../openapi/build-openapi-document.js'

const VERSION_FILE = new URL('../../VERSION', import.meta.url)
const OUTPUT = new URL('../../docs/openapi.json', import.meta.url)

const version = (await readFile(VERSION_FILE, 'utf8')).trim()
await writeFile(OUTPUT, formatOpenApiDocument(buildOpenApiDocument({ version })))
console.log(`wrote ${OUTPUT.pathname} (version ${version})`)
