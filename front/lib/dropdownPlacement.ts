// ボタンの下に開くメニュー (position: fixed) の置き場所を決める。表示言語の切り替えと行の操作メニューで共有する。

// メニューと画面の端の間に必ず空ける幅。端に付いたり、はみ出したりしないように。
export const DROPDOWN_VIEWPORT_MARGIN = 8
// メニューを開いたボタンとの隙間。
const DROPDOWN_ANCHOR_GAP = 4
// ボタンの下の余地がこれより狭く、上の方が広ければ上向きに開く。
const DROPDOWN_MIN_HEIGHT_BELOW = 200

export type DropdownAlignment = 'start' | 'end'

export interface DropdownAnchor {
  top: number
  bottom: number
  left: number
  width: number
}

/** position: fixed のメニューの置き場所。top と bottom はどちらか一方だけ入る。 */
export interface DropdownPlacement {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

/**
 * メニューをボタン (`anchor`、画面上の座標) の下に置き、画面の中に収める。
 * 幅はボタンと `minWidth` の広い方。`contentWidth` (中身の幅) を渡すと、中身に合わせて `maxWidth` まで広げる。
 * 画面が狭ければ画面に合わせて縮め、右端を越えるなら左へずらし、下の余地が少なければ上向きに開く。
 */
export function placeDropdown({
  anchor,
  viewport,
  minWidth,
  maxWidth = Number.POSITIVE_INFINITY,
  contentWidth,
  maxHeight,
  alignment = 'start',
}: {
  anchor: DropdownAnchor
  viewport: { width: number; height: number }
  minWidth: number
  maxWidth?: number
  contentWidth?: number
  maxHeight: number
  alignment?: DropdownAlignment
}): DropdownPlacement {
  const widestFit = Math.max(0, viewport.width - 2 * DROPDOWN_VIEWPORT_MARGIN)
  const preferredWidth = contentWidth === undefined ? minWidth : Math.min(Math.max(contentWidth, minWidth), maxWidth)
  const width = Math.min(Math.max(anchor.width, preferredWidth), widestFit)
  const rightmostLeft = viewport.width - DROPDOWN_VIEWPORT_MARGIN - width
  const alignedLeft = alignment === 'end' ? anchor.left + anchor.width - width : anchor.left
  const left = Math.max(DROPDOWN_VIEWPORT_MARGIN, Math.min(alignedLeft, rightmostLeft))
  const roomBelow = viewport.height - anchor.bottom - DROPDOWN_ANCHOR_GAP - DROPDOWN_VIEWPORT_MARGIN
  const roomAbove = anchor.top - DROPDOWN_ANCHOR_GAP - DROPDOWN_VIEWPORT_MARGIN
  const opensUpward = roomBelow < DROPDOWN_MIN_HEIGHT_BELOW && roomAbove > roomBelow
  if (opensUpward) {
    return {
      left,
      width,
      maxHeight: Math.max(0, Math.min(maxHeight, roomAbove)),
      bottom: viewport.height - anchor.top + DROPDOWN_ANCHOR_GAP,
    }
  }
  return {
    left,
    width,
    maxHeight: Math.max(0, Math.min(maxHeight, roomBelow)),
    top: anchor.bottom + DROPDOWN_ANCHOR_GAP,
  }
}
