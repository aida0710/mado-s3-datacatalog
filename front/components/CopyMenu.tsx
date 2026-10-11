import {
  memo, useEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, Ellipsis, X } from 'lucide-react'
import { copyToClipboard } from '../lib/clipboard'
import { DROPDOWN_VIEWPORT_MARGIN } from '../lib/dropdownPlacement'
import { useAnchoredPopover } from '../lib/useAnchoredPopover'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

export type MenuItem =
  | { kind: 'copy'; label: string; value: string }
  | { kind: 'download'; label: string; href: string; filename: string }
  | { kind: 'action'; label: string; onSelect: () => void }

// メニューの幅の下限と上限。中身 (コピーする URL など) に合わせてこの間で広げ、狭い画面では画面に合わせて縮める。
const MENU_MIN_WIDTH = 280
const MENU_MAX_WIDTH = 480
// メニューの高さは画面に収まる範囲で中身に任せる (項目は数個なので上限を設けない)。
const MENU_MAX_HEIGHT = Number.POSITIVE_INFINITY
// コピーした結果を見せておく時間。
const FEEDBACK_MS = 1500
// 結果の吹き出しをトリガーから離す距離。
const FEEDBACK_GAP = 6

interface Props {
  items: MenuItem[]
  /** トリガーの中身。既定は ⋯ のアイコン。 */
  trigger?: ReactNode
  ariaLabel?: string
}

interface Feedback {
  text: string
  ok: boolean
  style: CSSProperties
}

// 親の行 (<tr role="button">) の Enter / Space は行の操作 (プレビュー) を起こすので、
// メニューの中で押したキーは行へ伝えない。Escape は止めない (document で閉じる)。
const stopRowKeys = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
}

// 行や見出しの操作メニュー。アイコンのボタン (.icon-button) で開き、項目を選んで実行する。
// クリック外 / Escape で閉じる。コピーの結果はトリガーの上に小さな吹き出しで出す。
//
// メニューと吹き出しは document.body へ portal し position:fixed で配置する。行を内包する
// overflow:auto なラッパー — 表の .table-scroll (overflow-x:auto は CSS 仕様で overflow-y も
// auto になる) / ドロワーの本文 — にクリップされると、最下段や 1 件だけの行でメニューが
// 枠外へ落ち、見るのに余計なスクロールを強いられるため。
//
// memo でラップ: 一覧の各行は items を useMemo で安定化して渡すので、親の再レンダ時
// (loading フラグ更新等) に各 CopyMenu を再描画しなくて済む。
export const CopyMenu = memo(function CopyMenu({ items, trigger, ariaLabel = translate('copyMenu.actions') }: Props) {
  useLocale()
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const feedbackTimer = useRef<number | null>(null)
  // 横はトリガーの右端にそろえ、縦は下に余地が無ければ上向きに開く。開いている間はスクロールと
  // 画面のサイズ変更に合わせて置き直す。置き場所が決まるまで (undefined) は不可視で描いてチラつきを防ぐ。
  const menuStyle = useAnchoredPopover({
    isOpen: open, anchorRef: triggerRef, popoverRef: menuRef,
    minWidth: MENU_MIN_WIDTH, maxWidth: MENU_MAX_WIDTH, maxHeight: MENU_MAX_HEIGHT, alignment: 'end',
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      // トリガ側 (root) と portal 済みメニュー (menuRef) の内側なら閉じない。
      if (root.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => {
    if (feedbackTimer.current != null) window.clearTimeout(feedbackTimer.current)
  }, [])

  // 吹き出しはトリガーの上 (上に余地が無ければ下) に、右端を揃えて出す。
  const showFeedback = (text: string, ok: boolean) => {
    const r = triggerRef.current?.getBoundingClientRect()
    const style: CSSProperties = r
      ? {
          position: 'fixed',
          right: Math.max(DROPDOWN_VIEWPORT_MARGIN, Math.round(window.innerWidth - r.right)),
          ...(r.top > 48
            ? { bottom: Math.round(window.innerHeight - r.top + FEEDBACK_GAP) }
            : { top: Math.round(r.bottom + FEEDBACK_GAP) }),
        }
      : { position: 'fixed', right: DROPDOWN_VIEWPORT_MARGIN, bottom: DROPDOWN_VIEWPORT_MARGIN }
    setFeedback({ text, ok, style })
    if (feedbackTimer.current != null) window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }

  const onCopy = async (label: string, value: string) => {
    setOpen(false)
    const ok = await copyToClipboard(value)
    showFeedback(ok ? label : translate('common.copyFailed'), ok)
  }

  let triggerContent = trigger ?? <Ellipsis size={16} aria-hidden="true" />
  if (feedback) {
    triggerContent = feedback.ok
      ? <Check size={16} aria-hidden="true" />
      : <X size={16} aria-hidden="true" />
  }

  return (
    <div ref={root} className="copy-menu">
      <button
        ref={triggerRef}
        type="button"
        className="icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        // 親行 (FileRow) の onClick=preview を抑止しつつメニューを開く。
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        // 行 (<tr>) の onKeyDown は Enter/Space で行アクション (preview / モーダル) を
        // 発火するため、ここで押した 2 キーは伝播させない。native button の click は
        // ここで止めても発生するのでメニュー開閉は壊れない。Escape 等は止めない
        // ので、開いた直後に Escape で閉じる (document リスナ) が効いたまま。
        onKeyDown={stopRowKeys}
        title={ariaLabel}
      >
        {triggerContent}
      </button>
      {feedback && createPortal(
        <span
          role="status"
          className={feedback.ok ? 'copy-menu-feedback' : 'copy-menu-feedback is-error'}
          style={feedback.style}
        >
          {feedback.ok && <Check size={13} aria-hidden="true" />}
          {feedback.text}
        </span>,
        document.body,
      )}
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="copy-menu-list"
          onKeyDown={stopRowKeys}
          style={{
            position: 'fixed',
            ...menuStyle,
            // 配置確定前は不可視 (useLayoutEffect が paint 前に確定するのでチラつかない)。
            visibility: menuStyle ? 'visible' : 'hidden',
          }}
        >
          {items.map(it => {
            if (it.kind === 'download') {
              return (
                <a
                  key={it.label}
                  role="menuitem"
                  href={it.href}
                  download={it.filename}
                  className="copy-menu-item"
                  // 親行 (FileRow) の onClick=preview 抑止のため stopPropagation。
                  onClick={e => { e.stopPropagation(); setOpen(false) }}
                >
                  {it.label}
                </a>
              )
            }
            if (it.kind === 'action') {
              return (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  className="copy-menu-item"
                  // 親行 (FileRow) の onClick=preview 抑止のため stopPropagation。
                  onClick={e => { e.stopPropagation(); it.onSelect(); setOpen(false) }}
                >
                  {it.label}
                </button>
              )
            }
            return (
              <button
                key={it.label}
                role="menuitem"
                type="button"
                className="copy-menu-item"
                // 親行 (FileRow) の onClick=preview 抑止のため stopPropagation。
                onClick={e => { e.stopPropagation(); void onCopy(it.label, it.value) }}
                title={it.value}
              >
                {it.label}
                <span className="copy-menu-value">{it.value}</span>
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
})
