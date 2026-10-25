// `/edit-note` — ホームの Team note (slug='home') を Monaco で編集する 1-pane ページ。
//
// HomePage.tsx の「編集」 / 「作成」ボタンから <Link to="/edit-note"> で遷移してくる。
// 保存後は navigate('/') でホームに戻る。ホームを開き直すと useQuery が取り直すので、
// 明示的な refresh コールは不要。

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorNotice, LoadingMessage, useQuery } from '@mado/design-system/react'
import { api } from '../lib/api/client'
import { EditorPageHeader, EditorShell } from '../components/EditorShell'
import {
  MonacoMarkdownEditor,
  type MonacoMarkdownEditorHandle,
} from '../components/MonacoMarkdownEditor'
import { loadFailedMessage } from '../i18n/loadFailedMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

const HOME_NOTE_SLUG = 'home'

export default function NoteEditPage() {
  useLocale()
  const navigate = useNavigate()
  const note = useQuery({ key: `note:${HOME_NOTE_SLUG}`, load: () => api.note(HOME_NOTE_SLUG) })
  const editorRef = useRef<MonacoMarkdownEditorHandle>(null)

  if (note.error) {
    return (
      <>
        <EditorPageHeader title={translate('noteEditPage.editNote')} description={translate('section.teamNote')} />
        <ErrorNotice
          message={loadFailedMessage({ subject: translate('section.teamNote'), error: note.error })}
          retry={note.reload}
          retryLabel={translate('common.retry')}
        />
        <p className="muted">{translate('common.editingIsDisabledUntilTheContentLoadsTo')}</p>
      </>
    )
  }
  const data = note.value
  if (!data) {
    return (
      <>
        <EditorPageHeader title={translate('noteEditPage.editNote')} description={translate('section.teamNote')} />
        <LoadingMessage label={translate('common.loading')} />
      </>
    )
  }

  const goHome = () => navigate('/')

  return (
    <EditorShell
      title={translate('noteEditPage.editNote')}
      description={translate('section.teamNote')}
      initialBody={data.exists ? data.body : ''}
      onSave={body =>
        api.putNote(HOME_NOTE_SLUG, body).then(() => undefined)
      }
      onSaved={goHome}
      onCancel={goHome}
    >
      {({ body, setBody }) => (
        <MonacoMarkdownEditor
          ref={editorRef}
          value={body}
          onChange={setBody}
          height="100%"
          ariaLabel={translate('noteEditPage.noteContentMarkdown')}
        />
      )}
    </EditorShell>
  )
}
