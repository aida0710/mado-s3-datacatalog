import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const base = process.env.MADO_VERIFICATION_WEB_URL ?? 'http://127.0.0.1:6329'
const api = process.env.MADO_VERIFICATION_API_URL ?? 'http://127.0.0.1:4329'
for (const url of [base, api]) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Verification requires loopback URLs')
}
const marker = await (await fetch(`${api}/verification`)).json()
assert.deepEqual(marker, { kind: 'mado-access-tokens', database: 'dashboard_access_tokens_verify' })
const modulePath = process.env.MADO_PLAYWRIGHT_MODULE
if (!modulePath) throw new Error('Set MADO_PLAYWRIGHT_MODULE to an installed Playwright index.mjs')
const { chromium } = await import(pathToFileURL(modulePath).href)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.MADO_CHROMIUM_PATH ? { executablePath: process.env.MADO_CHROMIUM_PATH } : {}) })
const context = await browser.newContext({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo', viewport: { width: 1440, height: 1000 } })
await context.addInitScript(() => localStorage.setItem('mado.theme', 'light'))
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
page.on('console', message => {
  if (message.type() === 'error' && /TypeError:|ReferenceError:/.test(message.text())) pageErrors.push(message.text())
})
const directory = process.env.MADO_SCREENSHOT_DIR
const tokenName = '学習パイプライン'
const row = () => page.getByRole('article', { name: tokenName, exact: true })
async function screenshot(name, target = page) {
  if (!directory) return
  // Never capture a one-time credential, even in this disposable fixture.
  assert.equal(await page.locator('.secret-notice').count(), 0)
  await mkdir(directory, { recursive: true })
  await target.screenshot({ path: `${directory}/${name}.png`, ...(target === page ? { fullPage: false } : {}) })
}
async function openActions() { await row().locator('summary').click() }
async function probe(value, scope, status) {
  const response = await fetch(`${api}/verification/probe/${scope}`, { headers: { authorization: `Bearer ${value}` } })
  assert.equal(response.status, status)
}
async function readOneTimeValue() {
  const notice = page.locator('.secret-notice')
  await notice.waitFor()
  const value = await notice.locator('code').textContent()
  await notice.getByRole('button', { name: /^(閉じる|Close)$/ }).click()
  return value
}
async function switchLanguage(name) {
  await page.getByRole('button', { name: /^(Language|表示言語):/ }).click()
  await page.getByRole('menuitemradio', { name, exact: true }).click()
}

try {
  console.log('Access tokens: legacy URL opens the flat token list')
  await page.goto(`${base}/settings/access/service-accounts`)
  await page.waitForURL(`${base}/settings/access/tokens`)
  await page.getByRole('article', { name: 'ML Tracking', exact: true }).waitFor()
  assert.equal(await page.getByRole('article').count(), 3)
  assert.equal(await page.getByRole('combobox').count(), 0)
  await screenshot('access-tokens-list-ja')

  console.log('Access tokens: internal API permissions and explicit connection selection')
  await page.setViewportSize({ width: 1440, height: 1280 })
  await page.getByRole('button', { name: 'アクセストークンを作成', exact: true }).click()
  const internal = page.getByRole('dialog')
  assert.equal(await internal.getByRole('checkbox').filter({ visible: true }).count() > 0, true)
  assert.equal(await internal.locator('input[type="checkbox"]:checked').count(), 0)
  await internal.getByRole('textbox', { name: '名前', exact: true }).fill('内部APIの自動処理')
  await internal.getByRole('group', { name: 'Storage', exact: true }).getByRole('checkbox', { name: '読み取り', exact: true }).check()
  const notes = internal.getByRole('group', { name: 'Notes', exact: true })
  await notes.getByRole('checkbox', { name: '読み取り', exact: true }).check()
  await notes.getByRole('checkbox', { name: '編集', exact: true }).check()
  await internal.getByRole('searchbox', { name: '接続を検索', exact: true }).fill('Speech')
  await internal.getByRole('checkbox', { name: 'Speech Storage speech0001', exact: true }).check()
  await internal.getByRole('searchbox', { name: '接続を検索', exact: true }).fill('Backup')
  assert.equal(await internal.getByRole('checkbox', { name: 'Backup Storage backup0001', exact: true }).isChecked(), false)
  await internal.getByRole('searchbox', { name: '接続を検索', exact: true }).fill('')
  assert.equal(await internal.getByRole('checkbox', { name: 'Speech Storage speech0001', exact: true }).isChecked(), true)
  await internal.locator('.internal-permissions').scrollIntoViewIfNeeded()
  await screenshot('internal-api-permissions-ja')
  await screenshot('internal-api-permission-matrix-ja', internal.locator('.internal-permissions__rows'))
  await internal.locator('.token-connections').scrollIntoViewIfNeeded()
  await screenshot('internal-api-connections-ja', internal.locator('.token-connections'))
  await internal.getByRole('button', { name: '発行する', exact: true }).click()
  const internalValue = await readOneTimeValue()
  const internalHeaders = { Authorization: `Bearer ${internalValue}`, 'Content-Type': 'application/json' }
  for (const [path, method, status] of [
    ['/notes/home', 'GET', 200], ['/notes/home', 'PUT', 200],
    ['/storage/speech0001/buckets', 'GET', 200], ['/storage/backup0001/buckets', 'GET', 404],
    ['/connections', 'POST', 403], ['/users', 'GET', 403],
  ]) {
    const response = await fetch(`${api}/api/internal${path}`, { method, headers: internalHeaders,
      ...(method === 'PUT' ? { body: JSON.stringify({ body: 'Browser verification' }) } : {}) })
    assert.equal(response.status, status, `${method} ${path}`)
  }
  const internalRow = page.getByRole('article', { name: '内部APIの自動処理', exact: true })
  await internalRow.locator('summary').click()
  await internalRow.getByRole('button', { name: '削除', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '削除', exact: true }).click()
  await internalRow.waitFor({ state: 'detached' })
  assert.equal((await fetch(`${api}/api/internal/notes/home`, { headers: internalHeaders })).status, 401)
  await page.setViewportSize({ width: 1440, height: 1000 })

  console.log('Access tokens: issue one credential for dataset reads and lineage writes')
  await page.getByRole('button', { name: 'アクセストークンを作成', exact: true }).click()
  const create = page.getByRole('dialog')
  await create.getByRole('button', { name: 'ML Tracking連携', exact: true }).click()
  await create.getByRole('textbox', { name: '名前', exact: true }).fill(tokenName)
  await create.getByRole('textbox', { name: '用途のメモ', exact: true }).fill('データセット参照とDataLineageの送信')
  const namespaceSearch = create.getByRole('searchbox', { name: 'Namespaceを検索', exact: true })
  await create.getByRole('checkbox', { name: 'speech', exact: true }).waitFor()
  await namespaceSearch.fill('spe')
  await create.getByRole('checkbox', { name: 'speech', exact: true }).check()
  await namespaceSearch.fill('pod')
  await create.getByRole('checkbox', { name: 'podcast', exact: true }).check()
  assert.equal(await create.getByRole('group', { name: '選択済みのNamespace', exact: true }).getByRole('button').count(), 2)
  await screenshot('access-tokens-namespace-search-ja')
  await screenshot('namespace-selector-desktop', create.getByRole('group', { name: '許可Namespace', exact: true }))
  await namespaceSearch.fill('')
  assert.ok(await create.getByRole('checkbox', { name: 'speech', exact: true }).isChecked())
  assert.ok(await create.getByRole('checkbox', { name: 'podcast', exact: true }).isChecked())
  assert.equal(await create.getByRole('checkbox', { name: 'すべてのNamespaceを許可', exact: true }).isChecked(), false)
  assert.ok(await create.getByRole('checkbox', { name: 'データセット参照', exact: true }).isChecked())
  assert.ok(await create.getByRole('checkbox', { name: 'DataLineageの送信', exact: true }).isChecked())
  await screenshot('access-tokens-create-ja')
  await create.getByRole('button', { name: '発行する', exact: true }).click()
  const original = await readOneTimeValue()
  await row().waitFor()
  const metadata = await page.evaluate(async () => (await fetch('/api/internal/access-tokens')).json())
  assert.deepEqual(metadata.tokens.find(token => token.name === tokenName).namespaces, ['podcast', 'speech'])
  await probe(original, 'lineage:read', 200)
  await probe(original, 'lineage:write', 200)
  await probe(original, 'metrics:read', 403)

  console.log('Access tokens: regeneration retires the old value and retains both permissions')
  await openActions()
  await row().getByRole('button', { name: '再発行', exact: true }).click()
  await screenshot('access-tokens-regenerate-ja')
  await page.getByRole('dialog').getByRole('button', { name: '再発行', exact: true }).click()
  const regenerated = await readOneTimeValue()
  assert.ok(regenerated !== original, 'Regeneration must replace the credential')
  await probe(original, 'lineage:read', 401)
  await probe(regenerated, 'lineage:read', 200)
  await probe(regenerated, 'lineage:write', 200)

  console.log('Access tokens: disable/enable changes authentication immediately')
  await openActions()
  await row().getByRole('button', { name: '無効にする', exact: true }).click()
  await row().getByText('無効', { exact: true }).waitFor()
  await probe(regenerated, 'lineage:read', 401)
  await openActions()
  await row().getByRole('button', { name: '有効にする', exact: true }).click()
  await row().getByText('有効', { exact: true }).waitFor()
  await probe(regenerated, 'lineage:read', 200)

  console.log('Access tokens: permissions can be combined without changing the credential')
  await openActions()
  await row().getByRole('button', { name: '編集', exact: true }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: '容量メトリクス取得', exact: true }).check()
  await page.getByRole('dialog').getByRole('checkbox', { name: 'すべての接続を許可', exact: true }).check()
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
  await row().getByText('容量メトリクス取得', { exact: true }).waitFor()
  await probe(regenerated, 'metrics:read', 200)

  console.log('Access tokens: deleting needs confirmation and stops authentication')
  await openActions()
  await row().getByRole('button', { name: '削除', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'キャンセル', exact: true }).click()
  await probe(regenerated, 'lineage:read', 200)
  await openActions()
  await row().getByRole('button', { name: '削除', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '削除', exact: true }).click()
  await row().waitFor({ state: 'detached' })
  await probe(regenerated, 'lineage:read', 401)

  console.log('Access tokens: English/Japanese, dark theme and 320px width')
  await switchLanguage('English')
  await page.getByRole('button', { name: 'Create access token', exact: true }).waitFor()
  await screenshot('access-tokens-list-en')
  await page.getByRole('button', { name: 'Create access token', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name', exact: true }).fill('Language check')
  await screenshot('internal-api-permissions-en')
  await page.getByRole('dialog').getByRole('button', { name: 'ML Tracking integration', exact: true }).click()
  await page.getByRole('dialog').getByRole('checkbox', { name: 'speech', exact: true }).waitFor()
  await screenshot('access-tokens-create-en')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await switchLanguage('日本語')
  await page.getByRole('button', { name: 'ダークテーマにする', exact: true }).click()
  await page.setViewportSize({ width: 320, height: 800 })
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1)
  await screenshot('access-tokens-mobile-dark')
  await page.getByRole('button', { name: 'アクセストークンを作成', exact: true }).click()
  const mobileDialog = page.getByRole('dialog')
  await screenshot('internal-api-permissions-mobile-dark')
  await mobileDialog.getByRole('button', { name: 'ML Tracking連携', exact: true }).click()
  const mobileSearch = mobileDialog.getByRole('searchbox', { name: 'Namespaceを検索', exact: true })
  await mobileSearch.fill('spe')
  await mobileDialog.getByRole('checkbox', { name: 'speech', exact: true }).check()
  await mobileDialog.getByRole('checkbox', { name: 'speech', exact: true }).scrollIntoViewIfNeeded()
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1)
  await screenshot('access-tokens-namespace-mobile-dark')
  await screenshot('namespace-selector-mobile', mobileDialog.getByRole('group', { name: '許可Namespace', exact: true }))
  await mobileDialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('article', { name: 'ML Tracking', exact: true }).locator('summary').click()
  await screenshot('access-tokens-actions-dark')
  assert.deepEqual(pageErrors, [])
  if (directory) await writeFile(`${directory}/browser-result.json`, JSON.stringify({
    checks: ['initial permissions empty', 'internal API read and write', 'connection search and selection retained',
      'outside connection denied', 'administration denied', 'deleted token denied',
      'namespace search and checkbox selection', 'selection retained across searches', 'flat list', 'read/write with one token',
      'regeneration', 'disable/enable', 'permission updates', 'delete/cancel', 'old URL', 'English/Japanese', '320px/dark', 'no credentials in screenshots'],
    pageErrors,
  }, null, 2))
  console.log('Access-token browser checks passed; screenshots contain no credential values.')
} finally {
  await browser.close()
}
