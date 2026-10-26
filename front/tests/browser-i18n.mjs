// 表示言語の切り替えをブラウザで確かめる手動の試験 (npm test には入れていない)。
// 使い方: npm run build のあと npx vite preview --host 127.0.0.1 --port 5781 で画面を立ち上げ、
//   MDC_PLAYWRIGHT_MODULE=<Playwright の index.mjs> node tests/browser-i18n.mjs
// を実行する。MDC_CHROMIUM_PATH でブラウザ、MDC_WEB_URL で画面の URL、MDC_SCREENSHOT_DIR で撮影先を変えられる。
// API は i18nApi.mjs の見本が答えるので、API サーバーや DB は要らない。
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createI18nApi } from './i18nApi.mjs'

const modulePath = process.env.MDC_PLAYWRIGHT_MODULE
if (!modulePath) throw new Error('Set MDC_PLAYWRIGHT_MODULE to an installed Playwright index.mjs')
const { chromium } = await import(pathToFileURL(modulePath).href)
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  ...(process.env.MDC_CHROMIUM_PATH ? { executablePath: process.env.MDC_CHROMIUM_PATH } : {}) })
const base = process.env.MDC_WEB_URL ?? 'http://127.0.0.1:5781'
const screenshots = process.env.MDC_SCREENSHOT_DIR
const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 960 } })
const api = createI18nApi()
await context.route(url => url.pathname.startsWith('/api/'), api.route)
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', error => pageErrors.push(error.message))
async function switchLanguage(target, name) {
  await target.getByRole('button', { name: /^(Language|表示言語):/ }).click()
  await target.getByRole('menuitemradio', { name, exact: true }).click()
}
async function screenshot(name) {
  if (!screenshots) return
  await mkdir(screenshots, { recursive: true })
  await page.screenshot({ path: `${screenshots}/${name}.png`, fullPage: true })
}
try {
  await page.goto(`${base}/storage/${api.connection.id}/training-data/`)
  await page.getByRole('link', { name: 'Settings', exact: true }).waitFor()
  await page.getByText('manifest.json', { exact: true }).first().waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'en')
  await screenshot('catalog-en')
  const calls = api.state.calls.length
  await switchLanguage(page, '日本語')
  // 区分の名前 (Settings など) は日本語の画面でも英語のままなので、言語ボタンの名前で切り替わりを待つ。
  await page.getByRole('button', { name: /^表示言語:/ }).waitFor()
  await page.getByRole('link', { name: 'Settings', exact: true }).waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja')
  assert.equal(await page.evaluate(() => localStorage.getItem('mado.locale')), 'ja')
  await page.getByText('日本語の説明.txt', { exact: true }).first().waitFor()
  assert.equal(api.state.calls.length, calls, 'changing language must not refetch storage data')
  await screenshot('catalog-ja')

  await page.goto(`${base}/settings/connections/new`)
  await page.getByLabel('名前', { exact: true }).fill('Draft connection')
  const otherTab = await context.newPage()
  await otherTab.goto(`${base}/settings/connections`)
  await switchLanguage(otherTab, 'English')
  await page.getByLabel('Name', { exact: true }).waitFor()
  assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), 'Draft connection')
  await switchLanguage(page, '日本語')
  assert.equal(await page.getByLabel('名前', { exact: true }).inputValue(), 'Draft connection')
  await page.reload()
  await page.getByLabel('名前', { exact: true }).waitFor()
  assert.equal(await page.locator('html').getAttribute('lang'), 'ja')
  await otherTab.close()

  // ログイン前の画面でも同じ言語の切り替えが使えること。
  api.state.loggedIn = false
  await page.reload()
  await page.getByLabel('ユーザー名またはメールアドレス', { exact: true }).fill('draft-user')
  await switchLanguage(page, 'English')
  assert.equal(await page.getByLabel('Username or email address', { exact: true }).inputValue(), 'draft-user')
  await screenshot('catalog-login-en')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^Language:/ }).press('ArrowDown')
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).waitFor()
  await screenshot('catalog-login-mobile')
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: /^Language:/ }).evaluate(button => button === document.activeElement), true)
  api.state.loggedIn = true
  await page.goto(`${base}/storage/${api.connection.id}/training-data/`)
  await page.getByText('manifest.json', { exact: true }).first().waitFor()
  await page.getByRole('button', { name: /^Language:/ }).click()
  const menuBounds = await page.getByRole('menu').boundingBox()
  assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= 390, 'language menu must fit the viewport')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'header must fit the viewport')
  await screenshot('catalog-mobile')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 320, height: 768 })
  await page.getByRole('button', { name: /^Language:/ }).click()
  const narrowMenu = await page.getByRole('menu').boundingBox()
  assert.ok(narrowMenu.x >= 0 && narrowMenu.x + narrowMenu.width <= 320, 'language menu must fit a narrow phone')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'header must fit a narrow phone')
  assert.deepEqual(pageErrors, [])
  console.log('S3 Data Catalog: language detection, live switching, draft preservation, persistence, cross-tab sync, login and keyboard checks passed')
} finally {
  await browser.close()
}
