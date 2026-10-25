// コンテナのヘルスチェック (compose の healthcheck) から呼ぶ: `node dist/scripts/healthcheck.js 3000`。
// 配布イメージには curl も wget も無いので、Node の fetch で同じコンテナの `GET /healthz` を確かめる。
// API のイメージは api-internal と api-lineage が待ち受けるポートを変えて共有するので、ポートは引数で受ける。

// compose の healthcheck.timeout より短くし、応答の無いときはこのコマンド自身が失敗で終わる。
const REQUEST_TIMEOUT_MS = 2_000

const port = Number(process.argv[2])
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('usage: node dist/scripts/healthcheck.js <port>')
  process.exit(2)
}

try {
  const response = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  const body = await response.json() as { status?: unknown }
  if (!response.ok || body.status !== 'ok') {
    console.error(`unhealthy: HTTP ${response.status} ${JSON.stringify(body)}`)
    process.exit(1)
  }
} catch (error) {
  console.error('unhealthy:', error instanceof Error ? error.message : error)
  process.exit(1)
}
