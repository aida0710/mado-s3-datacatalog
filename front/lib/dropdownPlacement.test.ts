import { describe, expect, it } from 'vitest'
import { DROPDOWN_VIEWPORT_MARGIN, placeDropdown } from './dropdownPlacement'

const viewport = { width: 1280, height: 800 }

describe('placeDropdown', () => {
  it('ボタンの下に、ボタンの左端にそろえて開く', () => {
    const placement = placeDropdown({
      anchor: { top: 60, bottom: 90, left: 16, width: 160 },
      viewport,
      minWidth: 280,
      maxHeight: 420,
    })
    expect(placement).toEqual({ left: 16, width: 280, maxHeight: 420, top: 94 })
  })

  it('右端揃えではボタンの右端から左へメニューを開く', () => {
    const placement = placeDropdown({
      anchor: { top: 60, bottom: 90, left: 600, width: 40 },
      viewport,
      minWidth: 220,
      maxHeight: 160,
      alignment: 'end',
    })
    expect(placement.left + placement.width).toBe(640)
  })

  it('右端揃えで左にはみ出す場合も画面内へ収める', () => {
    const placement = placeDropdown({
      anchor: { top: 60, bottom: 90, left: 16, width: 40 },
      viewport,
      minWidth: 220,
      maxHeight: 160,
      alignment: 'end',
    })
    expect(placement.left).toBe(DROPDOWN_VIEWPORT_MARGIN)
  })

  it('ボタンが幅より広ければボタンの幅に合わせる', () => {
    const placement = placeDropdown({
      anchor: { top: 60, bottom: 90, left: 16, width: 400 },
      viewport,
      minWidth: 280,
      maxHeight: 420,
    })
    expect(placement.width).toBe(400)
  })

  it('右端からはみ出すときは左へずらす', () => {
    const placement = placeDropdown({
      anchor: { top: 60, bottom: 90, left: 1200, width: 60 },
      viewport,
      minWidth: 280,
      maxHeight: 420,
    })
    expect(placement.left + placement.width).toBe(viewport.width - DROPDOWN_VIEWPORT_MARGIN)
  })

  it('中身の幅を渡すと、下限と上限の間で中身に合わせる', () => {
    const anchor = { top: 60, bottom: 90, left: 16, width: 32 }
    const fitted = (contentWidth: number) =>
      placeDropdown({ anchor, viewport, minWidth: 280, maxWidth: 480, contentWidth, maxHeight: 420 }).width
    expect(fitted(120)).toBe(280)
    expect(fitted(360)).toBe(360)
    expect(fitted(900)).toBe(480)
  })

  it('画面より狭い幅に縮め、左右に余白を残す', () => {
    const placement = placeDropdown({
      anchor: { top: 60, bottom: 100, left: 14, width: 200 },
      viewport: { width: 360, height: 640 },
      minWidth: 400,
      maxHeight: 420,
    })
    expect(placement.left).toBe(DROPDOWN_VIEWPORT_MARGIN)
    expect(placement.width).toBe(360 - 2 * DROPDOWN_VIEWPORT_MARGIN)
  })

  it('下に余裕が無く上の方が広いときは上へ開き、高さを上の余裕に収める', () => {
    const placement = placeDropdown({
      anchor: { top: 700, bottom: 730, left: 16, width: 160 },
      viewport,
      minWidth: 280,
      maxHeight: 420,
    })
    expect(placement.top).toBeUndefined()
    expect(placement.bottom).toBe(800 - 700 + 4)
    expect(placement.maxHeight).toBe(420)
  })

  it('下に開くときは高さを下の余裕に収める', () => {
    const placement = placeDropdown({
      anchor: { top: 300, bottom: 330, left: 16, width: 160 },
      viewport: { width: 1280, height: 600 },
      minWidth: 280,
      maxHeight: 420,
    })
    expect(placement.top).toBe(334)
    expect(placement.maxHeight).toBe(600 - 330 - 4 - DROPDOWN_VIEWPORT_MARGIN)
  })
})
