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
async function screenshot(name) {
  if (!directory) return
  // Never capture a one-time credential, even in this disposable fixture.
  assert.equal(await page.locator('.secret-notice').count(), 0)
  await mkdir(directory, { recursive: true })
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: false })
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

  console.log('Access tokens: issue one credential for dataset reads and lineage writes')
  await page.getByRole('button', { name: 'アクセストークンを作成', exact: true }).click()
  const create = page.getByRole('dialog')
  await create.getByRole('textbox', { name: '名前', exact: true }).fill(tokenName)
  await create.getByRole('textbox', { name: '用途のメモ', exact: true }).fill('データセット参照とDataLineageの送信')
  await create.getByRole('textbox', { name: '許可Namespace', exact: true }).fill('speech, podcast')
  assert.ok(await create.getByRole('checkbox', { name: 'データセット参照', exact: true }).isChecked())
  assert.ok(await create.getByRole('checkbox', { name: 'DataLineageの送信', exact: true }).isChecked())
  await screenshot('access-tokens-create-ja')
  await create.getByRole('button', { name: '発行する', exact: true }).click()
  const original = await readOneTimeValue()
  await row().waitFor()
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
  await screenshot('access-tokens-create-en')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await switchLanguage('日本語')
  await page.getByRole('button', { name: 'ダークテーマにする', exact: true }).click()
  await page.setViewportSize({ width: 320, height: 800 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await screenshot('access-tokens-mobile-dark')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('article', { name: 'ML Tracking', exact: true }).locator('summary').click()
  await screenshot('access-tokens-actions-dark')
  assert.deepEqual(pageErrors, [])
  if (directory) await writeFile(`${directory}/browser-result.json`, JSON.stringify({
    checks: ['flat list', 'read/write with one token', 'regeneration', 'disable/enable', 'permission updates', 'delete/cancel', 'old URL', 'English/Japanese', '320px/dark', 'no credentials in screenshots'],
    pageErrors,
  }, null, 2))
  console.log('Access-token browser checks passed; screenshots contain no credential values.')
} finally {
  await browser.close()
}
