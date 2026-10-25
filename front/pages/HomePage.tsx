import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { History, Pencil } from 'lucide-react'
import { ErrorNotice, useQuery } from '@mado/design-system/react'
import { api } from '../lib/api/client'
import { getIntlLocale } from '../i18n/locale'
import { loadFailedMessage } from '../i18n/loadFailedMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

// 履歴モーダルはボタンを押した後にだけ描画する。React.lazy() で別チャンクへ。
const NoteHistoryModal = lazy(() =>
  import('../components/NoteHistoryModal').then(m => ({ default: m.NoteHistoryModal })),
)

const HOME_NOTE_SLUG = 'home'

function formatEditedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(getIntlLocale(), {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
}

// 最後に編集した人と日時を、見出しの下の一行にする。片方しか無ければある方だけで書く。
function lastEditedSummary(editor: string | null, when: string | null): string | null {
  if (editor && when) return translate('homePage.updatedByAt', { value0: editor, value1: when })
  if (editor) return translate('homePage.updatedBy', { value0: editor })
  if (when) return translate('homePage.updatedAt', { value0: when })
  return null
}

export default function HomePage() {
  useLocale()
  const note = useQuery({ key: `note:${HOME_NOTE_SLUG}`, load: () => api.note(HOME_NOTE_SLUG) })
  const [historyOpen, setHistoryOpen] = useState(false)

  if (note.error) {
    // 読み込めないときは「まだ何も書かれていません」や作成の導線を出さない。
    // 既存のノートがあるのに作成から書き始めると、保存で上書きしてしまうため。
    return (
      <>
        <header className="page-header">
          <div>
            <h1>{translate('section.teamNote')}</h1>
          </div>
        </header>
        <ErrorNotice
          message={loadFailedMessage({ subject: translate('section.teamNote'), error: note.error })}
          retry={note.reload}
          retryLabel={translate('common.retry')}
        />
      </>
    )
  }
  // 読み込むまでは何も出さない。「まだ何も書かれていません」を一瞬でも見せないように。
  const data = note.value
  if (!data) return null

  const summary = data.exists
    ? lastEditedSummary(
        data.last_editor || null,
        data.last_edited_at ? formatEditedAt(data.last_edited_at) || null : null,
      )
    : null
  const isPresent = data.exists && data.body.trim().length > 0

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{translate('section.teamNote')}</h1>
          {summary && <p className="page-description">{summary}</p>}
        </div>
        <div className="page-actions">
          <Link className="button" to="/edit-note">
            <Pencil size={15} aria-hidden="true" />
            {data.exists ? translate('common.edit') : translate('common.create')}
          </Link>
          <button
            type="button"
            className="button"
            onClick={() => setHistoryOpen(true)}
            title={translate('common.showEditHistory')}
          >
            <History size={15} aria-hidden="true" />
            {translate('common.history')}</button>
        </div>
      </header>

      {isPresent ? (
        <div className="markdown-body home-note">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {data.body}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="empty-state">
          <h2>{translate('homePage.noContentYet')}</h2>
          <p>{translate('homePage.allMembersCanContributeToTheSameNote')}</p>
          <ul>
            <li>{translate('homePage.informationAboutOtherApplications')}</li>
            <li>{translate('homePage.storageConnectionNotesWhereToFindData')}</li>
          </ul>
          <Link className="button primary" to="/edit-note">
            <Pencil size={15} aria-hidden="true" />
            {translate('homePage.writeTheFirstNote')}</Link>
        </div>
      )}

      {historyOpen && (
        <Suspense fallback={null}>
          <NoteHistoryModal
            slug={HOME_NOTE_SLUG}
            currentBody={data.exists ? data.body : null}
            onClose={() => setHistoryOpen(false)}
          />
        </Suspense>
      )}
    </>
  )
}
