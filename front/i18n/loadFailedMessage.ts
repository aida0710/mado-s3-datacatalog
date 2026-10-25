import { localizeMessage } from './localizeMessage'
import { translate } from './translate'

/** 投げられたものから、画面に出す理由 (サーバーのエラー文言など) を今の言語で取り出す。 */
export function errorReason(error: unknown): string {
  return localizeMessage(error instanceof Error ? error.message : String(error))
}

/**
 * 読み込めなかったことを、理由を添えた今の言語の一文にする (デザインシステムの ErrorNotice に渡す)。
 * 取得の失敗を「まだ無い」と分けて知らせる。README や Team note の失敗を「未作成」と見せると、
 * 利用者が空のエディタから書き始めて既存の本文を上書きしてしまうため。
 */
export function loadFailedMessage({ subject, error }: { subject: string; error: unknown }): string {
  const reason = errorReason(error)
  const message = translate('loadFailed.message', { value0: subject })
  return reason ? message + translate('common.parenthetical', { value0: reason }) : message
}
