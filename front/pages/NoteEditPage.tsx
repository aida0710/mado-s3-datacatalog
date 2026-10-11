// `/edit-note` — ホームの Team note (slug='home') を Monaco で編集する 1-pane ページ。
//
// HomePage.tsx の「編集」 / 「作成」ボタンから <Link to="/edit-note"> で遷移してくる。
// 保存後は navigate('/') でホームに戻る。ホームを開き直すと useRetryableLoad が取り直すので、
// 明示的な refresh コールは不要。

import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api/client'
import { useRetryableLoad } from '../lib/useRetryableLoad'
import { EditorPageHeader, EditorShell } from '../components/EditorShell'
import { LoadFailedNotice } from '../components/LoadFailedNotice'
import {
  MonacoMarkdownEditor,
  type MonacoMarkdownEditorHandle,
} from '../components/MonacoMarkdownEditor'

const loadHomeNote = () => api.note('home')

export default function NoteEditPage() {
  useLocale()
  const navigate = useNavigate()
  const { state, retry } = useRetryableLoad(loadHomeNote)
  const editorRef = useRef<MonacoMarkdownEditorHandle>(null)

  if (state.status === 'loading') {
    return (
      <>
        <EditorPageHeader title={translate("noteEditPage.editNote")} description={translate('section.teamNote')} />
        <p className="state-message">{translate("common.loading")}</p>
      </>
    )
  }
  if (state.status === 'failed') {
    return (
      <>
        <EditorPageHeader title={translate("noteEditPage.editNote")} description={translate('section.teamNote')} />
        <LoadFailedNotice subject={translate('section.teamNote')} reason={localizeMessage(state.reason)} onRetry={retry}>
          {translate("common.editingIsDisabledUntilTheContentLoadsTo")}</LoadFailedNotice>
      </>
    )
  }
  const data = state.value

  const goHome = () => navigate('/')

  return (
    <EditorShell
      title={translate("noteEditPage.editNote")}
      description={translate('section.teamNote')}
      initialBody={data.exists ? data.body : ''}
      onSave={(body, editor) =>
        api.putNote('home', body, editor).then(() => undefined)
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
          ariaLabel={translate("noteEditPage.noteContentMarkdown")}
        />
      )}
    </EditorShell>
  )
}
