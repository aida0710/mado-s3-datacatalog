import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Dialog } from '@mado/design-system/react'
import { MarkdownView } from './MarkdownView'
import { fmtDateTime, fmtSize } from '../lib/format'
import { useHistoryVersions, type HistorySource } from '../lib/useHistoryVersions'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

interface Props extends HistorySource {
  /** 見出しの下の小さな補足。履歴の対象 (ノートの名前や README の場所) を示す。 */
  subtitle: ReactNode
  /** 何の履歴か ("README の履歴" など)。 */
  title: ReactNode
  /** 現在の本文。一致する版に「現在と一致」の注記を出す。null = 現在は本文なし。 */
  currentBody: string | null
  onClose: () => void
}

/** 編集履歴のダイアログ。左に版の一覧、右に選んだ版の Markdown を表示する。
 *  README と Team note で取得元だけが違うので、それは HistorySource で受け取る。 */
export function HistoryModal({
  subtitle, title, currentBody, onClose, loadVersions, loadVersion,
}: Props) {
  useLocale()
  const { state, selectVersion } = useHistoryVersions({ loadVersions, loadVersion })
  const { versions, error, selectedId, selectedBody } = state

  return (
    <Dialog
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      closeLabel={translate('historyModal.closeHistory')}
      size="extra-wide"
      // 本文を読むだけのダイアログなので、背景のクリックでも閉じる。
      closesOnBackdropClick
    >
      <div className="dialog-body">
        {error && <p className="notice error">{localizeMessage(error)}</p>}
        {!error && versions === null && <p className="state-message">{translate('common.loading')}</p>}
        {!error && versions !== null && versions.length === 0 && (
          <p className="state-message">{translate('historyModal.noHistoryYet')}</p>
        )}

        {versions !== null && versions.length > 0 && (
          <div className="history-layout">
            <ul className="history-versions">
              {versions.map((version, index) => (
                <li key={version.id}>
                  <button
                    type="button"
                    className="history-version"
                    aria-current={selectedId === version.id ? 'true' : undefined}
                    onClick={() => selectVersion(version.id)}
                  >
                    <span className="history-version__editor">
                      {version.editor}
                      {index === 0 && <span className="status-badge status-accent">{translate('historyModal.latest')}</span>}
                    </span>
                    <span className="muted">
                      {fmtDateTime(version.edited_at)} · {fmtSize(version.size_bytes)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="history-preview">
              {selectedBody === null ? (
                <p className="state-message">{translate('common.loading')}</p>
              ) : (
                <>
                  {currentBody !== null && selectedBody.body === currentBody && (
                    <p className="notice history-match">
                      <Check size={14} aria-hidden="true" />
                      <span>{translate('historyModal.thisVersionMatchesTheCurrentContent')}</span>
                    </p>
                  )}
                  <MarkdownView source={selectedBody.body} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
