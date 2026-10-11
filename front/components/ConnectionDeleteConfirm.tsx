import { TranslatedMessage } from '../i18n/TranslatedMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'

interface Props {
  name: string
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function ConnectionDeleteConfirm({ name, onConfirm, onCancel }: Props) {
  useLocale()
  return (
    <DeleteConfirmDialog
      titleId="connection-delete-title"
      title={translate("common.deleteConnection")}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <TranslatedMessage message="connectionDeleteConfirm.confirm" values={{ value0: <strong className="mono">{name}</strong> }} />
    </DeleteConfirmDialog>
  )
}
