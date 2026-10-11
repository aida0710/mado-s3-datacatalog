import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react'
import { placeDropdown, type DropdownAlignment } from './dropdownPlacement'

// popover 属性を付けた要素は最上位の層に出し、サイドバーの overflow や重なり順に隠れないようにする。
// 属性の無い要素 (body へ portal するもの) と Popover API の無いブラウザでは、position: fixed で置くだけ。
function showsInTopLayer(element: HTMLElement): boolean {
  return element.hasAttribute('popover') && typeof element.showPopover === 'function'
}

/**
 * 開いている間、`popoverRef` の要素を `anchorRef` の要素の下 (余地が無ければ上) に画面からはみ出さずに置き、
 * 画面のサイズ変更やスクロールに合わせて置き直す。置き場所の style を返す。
 * `maxWidth` を渡すと、幅を中身に合わせて `minWidth` から `maxWidth` の間で決める。
 */
export function useAnchoredPopover({
  isOpen,
  anchorRef,
  popoverRef,
  minWidth,
  maxWidth,
  maxHeight,
  alignment = 'start',
}: {
  isOpen: boolean
  anchorRef: RefObject<HTMLElement | null>
  popoverRef: RefObject<HTMLElement | null>
  minWidth: number
  maxWidth?: number
  maxHeight: number
  alignment?: DropdownAlignment
}): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>()
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const popover = popoverRef.current
    if (!isOpen || !anchor || !popover) return
    if (showsInTopLayer(popover) && !popover.matches(':popover-open')) popover.showPopover()
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      setStyle(placeDropdown({
        anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        minWidth,
        maxWidth,
        contentWidth: maxWidth === undefined ? undefined : popover.scrollWidth,
        maxHeight,
        alignment,
      }))
    }
    place()
    window.addEventListener('resize', place)
    // capture にすると、サイドバーや表の枠の中のスクロールも拾える (ボタンも一緒に動くので)。
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      if (showsInTopLayer(popover) && popover.matches(':popover-open')) popover.hidePopover()
      // 次に開くときは、置き場所を決める前の大きさ (中身の幅) から測り直す。
      setStyle(undefined)
    }
  }, [isOpen, anchorRef, popoverRef, minWidth, maxWidth, maxHeight, alignment])
  return isOpen ? style : undefined
}
