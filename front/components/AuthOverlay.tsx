import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

interface Props {
  /** 見出し要素の id。dialog の aria-labelledby に使う。 */
  titleId: string
  children: ReactNode
}

// 背後の画面が window や document で受けているキー操作（Escape でモーダルを閉じるなど）へ
// 届かせない。React は root で受けてから stopPropagation を元のイベントにも伝えるので、
// window と document の listener には届かない。
const keepKeyInOverlay = (event: KeyboardEvent) => event.stopPropagation()

/**
 * session が切れたとき、開いていた画面の上にログイン画面（または初回のパスワード変更画面）を
 * 重ねる。背後の画面は AuthGate が inert にして残す。入り直すまで閉じられないので、Escape でも
 * 閉じない。
 *
 * モーダルの <dialog> で開き、トップレイヤーに出す。背後の画面で開いていたダイアログもトップ
 * レイヤーにあるので、ただの重ねた要素ではそれらの下に隠れてしまう。後から開いたこちらが一番上になる。
 */
export function AuthOverlay({ titleId, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  // 背後の画面は inert で focus を受け取れないので、focus をこちらへ移す。見えた時点で
  // focus が中にあるよう、描画と同じタイミング（layout effect）で開いて移す。
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    dialog.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="auth-overlay"
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={event => event.preventDefault()}
      onKeyDown={keepKeyInOverlay}
    >
      {children}
    </dialog>
  )
}
