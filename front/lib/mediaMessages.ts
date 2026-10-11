// メディア準備の表示文言。通信処理から切り離し、表示言語の変更箇所をまとめる。
import { translate } from '../i18n/translate'
export const mediaMessages = {
  get tarPreparationTimeout() { return translate('mediaMessages.preparingTheTarArchiveIsTakingLongerThan') },
  get archiveChanged() { return translate('mediaMessages.theTarArchiveHasChangedRefreshTheListing') },
}
