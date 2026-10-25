import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { setLocale } from './i18n/locale'

// 既存の画面のテストは日本語の文言で書いてあるので、テスト環境のブラウザの言語によらず日本語で描く。
setLocale('ja')
afterEach(() => setLocale('ja'))

// jsdom には matchMedia が無い。テストはすべて desktop (>= sm) 想定で書かれて
// いるので、どのクエリに対しても matches=true を返す no-op を入れる。
// 個別テストで mobile 表示が要るときは spyOn して上書きする。
;(globalThis as unknown as { matchMedia: typeof window.matchMedia }).matchMedia =
  ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

// jsdom には IntersectionObserver が無いので、観測だけ受け流す no-op モックを
// 入れる。実際の交差判定が要るテストでは spyOn して上書きする想定。
class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  root = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []
}
;(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver

// jsdom には ResizeObserver も無い。ReadmeView の折りたたみ判定などが生成するので
// 観測を受け流す no-op を入れる。サイズ変化に応じた再判定が要るテストでは
// spyOn して上書きする想定。
class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
  MockResizeObserver as unknown as typeof ResizeObserver

// jsdom には Popover API が無く、popover 属性の要素は既定の CSS で隠れたままになる。部品は popover を
// 開いている間だけ描くので、テストでは描いた popover を開いた状態として見せる。jsdom の
// getComputedStyle は詳細度だけで規則を選ぶので、既定の CSS の規則より詳細度を高くする。
// CSS の決まりを読むテスト (styles/designTokens.test.ts) は node の環境で動くので、文書がある時だけ足す。
if (typeof document !== 'undefined') {
  const popoverStyle = document.createElement('style')
  popoverStyle.textContent = '[popover][popover][popover][popover] { display: block; }'
  document.head.append(popoverStyle)
}

// jsdom にはモーダルのダイアログ (showModal / close) が無い。ブラウザの開く・閉じるの代わりに、
// open 属性を付け外しする (デザインシステムのテストと同じ)。
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}
