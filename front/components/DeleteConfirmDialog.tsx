import type { ReactNode } from 'react'
import { ActionConfirmDialog } from './ActionConfirmDialog'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

interface Props {
  titleId: string
  title: string
  /** 何を削除するかの説明。名前を強調したいときは呼び出し側で JSX にする。 */
  children: ReactNode
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/** 「〜を削除します。よろしいですか?」の確認ダイアログ。
 *  削除中はボタンと閉じる操作を止め、失敗したら理由をダイアログ内に出して閉じない。 */
export function DeleteConfirmDialog({ titleId, title, children, onConfirm, onCancel }: Props) {
  useLocale()
  return (
    <ActionConfirmDialog titleId={titleId} title={title} onConfirm={onConfirm} onCancel={onCancel}
      confirmLabel={translate('common.delete')} pendingLabel={translate('deleteConfirmDialog.deleting')}>
      {children}
    </ActionConfirmDialog>
  )
}
