import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyMenu, type MenuItem } from './CopyMenu'

vi.mock('../lib/clipboard', () => ({
  copyToClipboard: vi.fn(async () => true),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

// getBoundingClientRect の最小モック。top / bottom だけ effect が参照する。
const rect = (top: number, bottom: number): DOMRect =>
  ({
    top, bottom, left: 0, right: 20, width: 20, height: bottom - top, x: 0, y: top,
    toJSON: () => ({}),
  }) as DOMRect

describe('CopyMenu - ダウンロード項目の揃え', () => {
  // ダウンロード項目 (<a>) は親の td の text-align: right を継承して右寄せにならないよう、
  // コピー項目 (<button>) と同じ共通の項目の形 (左寄せを明示した .menu-item) を使う。
  it('ダウンロードのリンクもコピー項目と同じ形 (左寄せ) になる', async () => {
    const user = userEvent.setup()
    const items: MenuItem[] = [
      { kind: 'download', label: 'このファイルをダウンロード', href: 'http://x/dl', filename: 'f.bin' },
      { kind: 'copy', label: 'S3 URL をコピー', value: 's3://b/k' },
    ]
    render(<CopyMenu items={items} />)
    await user.click(screen.getByRole('button', { name: 'アクション' }))
    const dl = screen.getByRole('menuitem', { name: 'このファイルをダウンロード' })
    const copy = screen.getByRole('menuitem', { name: /S3 URL をコピー/ })
    expect(dl).toHaveClass('menu-item')
    expect(copy).toHaveClass('menu-item')
  })
})

describe('CopyMenu - キーボードで閉じる', () => {
  const items: MenuItem[] = [
    { kind: 'copy', label: 'A', value: 'a' },
    { kind: 'copy', label: 'B', value: 'b' },
  ]

  // トリガーの onKeyDown は Enter/Space だけ止める (行の誤発火防止)。Escape は
  // 止めないので、開いた直後にトリガーへフォーカスが残った状態でも document の
  // keydown リスナに届き、メニューを閉じられる。
  it('Escape で閉じ、トリガーにフォーカスが残る', async () => {
    const user = userEvent.setup()
    render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    // click 後もトリガーがフォーカスを保持している。そのまま Escape で閉じる。
    expect(trigger).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

describe('CopyMenu - 開く向き (トップレイヤー + fixed)', () => {
  const items: MenuItem[] = [
    { kind: 'copy', label: 'A', value: 'a' },
    { kind: 'copy', label: 'B', value: 'b' },
  ]

  it('メニューは popover としてトップレイヤーに開き、DOM の上ではトリガーのそばに置く', async () => {
    const user = userEvent.setup()
    const { container } = render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(80, 100))
    await user.click(trigger)
    const menu = screen.getByRole('menu')
    // overflow ラッパーにクリップされないようトップレイヤーに出しつつ、モーダルのダイアログの
    // 中から開いても操作できるよう、部品の中に置く。
    expect(menu).toHaveAttribute('popover', 'manual')
    expect(container).toContainElement(menu)
  })

  it('トリガーの下に余裕があれば下に開く', async () => {
    const user = userEvent.setup()
    render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(80, 100))
    await user.click(trigger)
    const menu = screen.getByRole('menu')
    expect(menu.style.top).not.toBe('auto') // r.bottom + gap
    expect(menu.style.bottom).toBe('auto')
  })

  it('トリガーが画面下端に近ければ上に開く', async () => {
    const user = userEvent.setup()
    render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    // jsdom の既定 window.innerHeight=768。下端付近に置くと下に収まらない。
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(740, 760))
    await user.click(trigger)
    const menu = screen.getByRole('menu')
    expect(menu.style.bottom).not.toBe('auto')
    expect(menu.style.top).toBe('auto')
  })
})

// スマホ幅で「横に突き抜ける」不具合の回帰テスト。トリガーの右端にそろえるだけだと、
// トリガーが画面左寄り (パンくず等) にあるとき、メニューの左端が負の座標へ回り込んで見切れる。
describe('CopyMenu - 横方向の画面内収め', () => {
  const items: MenuItem[] = [
    { kind: 'copy', label: 'A', value: 'a' },
    { kind: 'copy', label: 'B', value: 'b' },
  ]
  const MENU_MIN_WIDTH = 280
  const MARGIN = 8

  // jsdom の innerWidth は getter なので defineProperty で差し替える。
  const setViewportWidth = (w: number) => {
    Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
  }
  const originalWidth = window.innerWidth
  afterEach(() => setViewportWidth(originalWidth))

  it('トリガーが右端から遠ければ左端を画面内に収める', async () => {
    const user = userEvent.setup()
    render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    // rect() のトリガは left=0/right=20 — 画面左端。素朴に右端をそろえると左端が -260px になる。
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(80, 100))
    await user.click(trigger)
    const menu = screen.getByRole('menu')

    expect(parseFloat(menu.style.left)).toBeGreaterThanOrEqual(MARGIN)
  })

  it('phone 幅ではメニューを画面幅に縮める', async () => {
    const user = userEvent.setup()
    setViewportWidth(260)
    render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(80, 100))
    await user.click(trigger)
    const menu = screen.getByRole('menu')

    // 幅が画面の幅から左右の余白を引いた分を超えず、左端も画面内に収まる。
    expect(parseFloat(menu.style.width)).toBe(260 - MARGIN * 2)
    expect(parseFloat(menu.style.left)).toBe(MARGIN)
  })

  it('中身が狭ければ下限の幅で開く', async () => {
    const user = userEvent.setup()
    setViewportWidth(1600)
    render(<CopyMenu items={items} />)
    const trigger = screen.getByRole('button', { name: 'アクション' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(rect(80, 100))
    await user.click(trigger)
    const menu = screen.getByRole('menu')

    expect(parseFloat(menu.style.width)).toBe(MENU_MIN_WIDTH)
  })
})
