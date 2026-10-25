// `/storage/:connectionId/edit-readme/:bucket/*` — 任意 prefix の README を Monaco で編集する
// 2-pane ページ。左ペインに「現在 prefix の直下のファイル/ディレクトリ」を出し、
// 行クリックで Monaco の現在カーソル位置に `[name](/storage/connection/bucket/path)` を挿入する。
//
// 保存後は元の StorageBucket ページに戻る。

import { useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorNotice, LoadingMessage, useQuery } from '@mado/design-system/react'
import { api } from '../lib/api/client'
import { encPath } from '../lib/route'
import { useCapabilities } from '../lib/useCapabilities'
import { EditorPageHeader, EditorShell } from '../components/EditorShell'
import { InsertableFileList, type InsertableEntry } from '../components/InsertableFileList'
import {
  MonacoMarkdownEditor,
  type MonacoMarkdownEditorHandle,
} from '../components/MonacoMarkdownEditor'
import { loadFailedMessage } from '../i18n/loadFailedMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

interface Props { connectionId: string }

export default function ReadmeEditPage({ connectionId }: Props) {
  useLocale()
  // React Router v7 では splat は params['*'] で取れる。
  const params = useParams<{ bucket: string; '*': string }>()
  const bucket = params.bucket ?? ''
  // URL splat (例: 'docs/sub') を S3 prefix 形式 ('docs/sub/' or '') に正規化。
  const splat = params['*'] ?? ''
  const prefix = splat === '' ? '' : splat.endsWith('/') ? splat : splat + '/'

  const navigate = useNavigate()
  const caps = useCapabilities(connectionId)
  const editorRef = useRef<MonacoMarkdownEditorHandle>(null)

  // 編集できない (バケットが無い・接続で編集が無効) 間は読まない。
  const readme = useQuery({
    key: bucket && caps.readmeWrite ? `readme:${connectionId}:${bucket}:${prefix}` : null,
    load: () => {
      // キャッシュ（最大 6 時間前）の本文から編集を始めると、その間にほかの人が保存した
      // 更新を、保存で黙って上書きしてしまう。編集の元は必ずサーバーから取り直す。
      api.invalidateReadme(connectionId, bucket, prefix)
      return api.readme({ connectionId, bucket, prefix })
    },
  })

  if (!bucket) {
    return <p className="state-message">{translate('readmeEditPage.noBucketSpecified')}</p>
  }

  // 見出しの下に出す場所。bucket と prefix を / で繋ぐ。空 prefix は (root) と表記。
  const readmeLocation = prefix
    ? `${bucket} / ${prefix.replace(/\/$/, '')}`
    : `${bucket} / (root)`
  const title = translate('readmeEditPage.editReadme')
  const description = <span className="mono">{readmeLocation}</span>

  // 導線は ReadmeView 側で隠しているが、URL を直に開かれた場合の受け皿。
  // 実際の遮断は API 側 (PUT が 403) が担う。
  if (!caps.readmeWrite) {
    return (
      <>
        <EditorPageHeader title={title} description={description} />
        <p className="state-message">{translate('readmeEditPage.readmeEditingIsDisabledForThisConnection')}</p>
      </>
    )
  }
  if (readme.error) {
    return (
      <>
        <EditorPageHeader title={title} description={description} />
        <ErrorNotice
          message={loadFailedMessage({ subject: 'README', error: readme.error })}
          retry={readme.reload}
          retryLabel={translate('common.retry')}
        />
        <p className="muted">{translate('common.editingIsDisabledUntilTheContentLoadsTo')}</p>
      </>
    )
  }
  const data = readme.value
  if (!data) {
    return (
      <>
        <EditorPageHeader title={title} description={description} />
        <LoadingMessage label={translate('common.loading')} />
      </>
    )
  }

  const handleInsert = (entry: InsertableEntry) => {
    // 表示テキスト: ディレクトリには末尾 / を付ける。
    const display = entry.isDir ? `${entry.name}/` : entry.name
    // mado 内 URL を組み立て。fullKey は S3 のフルキー (prefix 含む)。
    const url = `/storage/${encodeURIComponent(connectionId)}/${encodeURIComponent(bucket)}/${encPath(entry.fullKey)}`
    editorRef.current?.insertAtCursor(`[${display}](${url})`)
  }

  const goBack = () => {
    const back = `/storage/${encodeURIComponent(connectionId)}/${encodeURIComponent(bucket)}/${encPath(prefix)}`
    navigate(back)
  }

  return (
    <EditorShell
      title={title}
      description={description}
      initialBody={data.exists ? data.body : ''}
      onSave={body =>
        api.putReadme({ connectionId, bucket, prefix, body }).then(() => undefined)
      }
      onSaved={goBack}
      onCancel={goBack}
      leftPane={
        <InsertableFileList
          connectionId={connectionId}
          bucket={bucket}
          prefix={prefix}
          onInsert={handleInsert}
        />
      }
    >
      {({ body, setBody }) => (
        <MonacoMarkdownEditor
          ref={editorRef}
          value={body}
          onChange={setBody}
          height="100%"
          ariaLabel={translate('readmeEditPage.readmeContentMarkdown')}
        />
      )}
    </EditorShell>
  )
}
