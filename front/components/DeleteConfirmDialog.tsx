import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { useState, type ReactNode } from 'react'
import { Dialog } from './Dialog'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      titleId={titleId}
      title={title}
      onClose={onCancel}
      dismissible={!busy}
      narrowLayout="sheet"
      footer={
        <>
          <button type="button" className="button" onClick={onCancel} disabled={busy}>{translate("common.cancel")}</button>
          <button type="button" className="button danger" onClick={() => void submit()} disabled={busy}>
            {busy ? translate("deleteConfirmDialog.deleting") : translate("common.delete")}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p className="delete-confirm__message">{children}</p>
        {error && <p className="notice error" aria-live="polite">{localizeMessage(error)}</p>}
      </div>
    </Dialog>
  )
}
