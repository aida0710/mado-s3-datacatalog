import { useCodeLanguage } from '@mado/design-system/react'
import { api } from '../lib/api/client'
import { CODE_LANGUAGE_STORAGE_KEY } from '../lib/codeLanguage'
import { useSniffedText } from '../lib/useSniffedText'
import { CodeFormatSelect, CodeView } from './CodeView'
import { CopyButton } from './CopyButton'
import { UnsupportedPreview } from './UnsupportedPreview'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

export function PreviewText({ connectionId, bucket, k }: { connectionId: string; bucket: string; k: string }) {
  useLocale()
  const sniffed = useSniffedText(api.textPreviewUrl(connectionId, bucket, k))

  if (sniffed.status === 'error') return <p className="notice error">{sniffed.message}</p>
  if (sniffed.status === 'loading') return <p className="muted">{translate('common.loading')}</p>
  if (sniffed.status === 'binary') return <UnsupportedPreview />
  return <TextBody name={k} text={sniffed.text} />
}

/** 読み込んだテキスト。形式を推測して色を付け、帯の選択欄で形式を選び直せる。 */
function TextBody({ name, text }: { name: string; text: string }) {
  useLocale()
  const code = useCodeLanguage({ storageKey: CODE_LANGUAGE_STORAGE_KEY, fileName: name, text })

  return (
    <div className="preview-stack">
      <div className="preview-toolbar">
        <CodeFormatSelect code={code} />
        <div className="preview-actions">
          <CopyButton value={text} label={translate('previewText.copyContent')} />
        </div>
      </div>
      <CodeView text={text} language={code.language} className="preview-code" />
    </div>
  )
}
