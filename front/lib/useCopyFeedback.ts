import { useEffect, useRef, useState } from 'react'
import { copyText } from '@mado/design-system/clipboard'

/** コピーした結果 (「コピーしました」「コピーできませんでした」) を出しておく時間。読み取れて、次の操作を待たせない長さ。 */
export const COPY_FEEDBACK_MS = 1500

/**
 * テキストをコピーし、その成否を COPY_FEEDBACK_MS の間だけ返す。copied は null = まだ押していない
 * (または表示を戻した後)、true / false = 直前のコピーの成否。
 */
export function useCopyFeedback(): { copied: boolean | null; copy: (value: string) => Promise<void> } {
  const [copied, setCopied] = useState<boolean | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 表示を戻す前に部品が外れたら (ピンはボタン一発で消える)、外れた後に戻さないよう止める。
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = async (value: string) => {
    setCopied(await copyText(value))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), COPY_FEEDBACK_MS)
  }
  return { copied, copy }
}
