import { useEffect, useReducer } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../lib/api/client'
import type { Tag } from '../lib/api/types'
import { DeleteConfirmDialog } from './DeleteConfirmDialog'
import { Dialog } from './Dialog'
import { TagBadge } from './TagBadge'
import { ImportExportButtons } from './ImportExportButtons'
import { SettingsSectionHeader } from './SettingsSectionHeader'
import { downloadJson, type ImportMode, type ImportSummary } from '../lib/jsonFile'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

// エクスポート形式。id は書き出さない — インポート先で採番するため
// (id は nanoid で、環境をまたいで意味を持たない)。同一性は name で見る。
interface TagsExport {
  mado: 'tags'
  version: 1
  tags: Array<{ name: string; color: string }>
}

interface State {
  tags: Tag[]
  loading: boolean
  error: string | null
  adding: boolean
  editing: Tag | null
  deleting: Tag | null
}

type Action =
  | { type: 'loadOk'; tags: Tag[] }
  | { type: 'loadErr'; error: string }
  | { type: 'openAdd' }
  | { type: 'openEdit'; tag: Tag }
  | { type: 'openDelete'; tag: Tag }
  | { type: 'closeModal' }

const initial: State = { tags: [], loading: true, error: null, adding: false, editing: null, deleting: null }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'loadOk':    return { ...s, loading: false, tags: a.tags }
    case 'loadErr':   return { ...s, loading: false, error: a.error }
    case 'openAdd':   return { ...s, adding: true }
    case 'openEdit':  return { ...s, editing: a.tag }
    case 'openDelete':return { ...s, deleting: a.tag }
    case 'closeModal':return { ...s, adding: false, editing: null, deleting: null }
  }
}

// 新規作成・編集共通の小さいフォーム (2 フィールドのみなので
// ConnectionForm のような別ファイルには分けない)。
function TagForm({
  initialValue, onSubmit, onCancel,
}: {
  initialValue: { name: string; color: string }
  onSubmit: (v: { name: string; color: string }) => Promise<void>
  onCancel: () => void
}) {
  useLocale()
  const [name, setName] = useReducer((_: string, v: string) => v, initialValue.name)
  const [color, setColor] = useReducer((_: string, v: string) => v, initialValue.color)
  const [saving, setSaving] = useReducer((_: boolean, v: boolean) => v, false)
  const [error, setError] = useReducer((_: string | null, v: string | null) => v, null)

  const submit = async () => {
    if (!name.trim()) { setError(translate('common.enterAName')); return }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), color })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      titleId="tag-form-title"
      title={initialValue.name ? translate('common.editTags') : translate('tagsSettings.addTag')}
      onClose={onCancel}
      dismissible={!saving}
      narrowLayout="sheet"
      footer={
        <>
          <button type="button" className="button" onClick={onCancel} disabled={saving}>{translate('common.cancel')}</button>
          <button type="button" className="button primary" onClick={() => void submit()} disabled={saving}>
            {saving ? translate('common.saving') : translate('common.save')}
          </button>
        </>
      }
    >
      <div className="dialog-body tag-form">
        <label className="field">
          <span>{translate('common.name')}</span>
          <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label className="field">
          <span>{translate('tagsSettings.color')}</span>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        </label>
        {error && <p className="notice error" aria-live="polite">{localizeMessage(error)}</p>}
      </div>
    </Dialog>
  )
}

function DeleteConfirm({
  tag, onConfirm, onCancel,
}: { tag: Tag; onConfirm: () => Promise<void>; onCancel: () => void }) {
  useLocale()
  return (
    <DeleteConfirmDialog
      titleId="tag-delete-title"
      title={translate('common.deleteTag')}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {translate('tagsSettings.confirmDeletion', { value0: tag.name })}
    </DeleteConfirmDialog>
  )
}

export function TagsSettings() {
  useLocale()
  const [state, dispatch] = useReducer(reducer, initial)
  const { tags, loading, error, adding, editing, deleting } = state

  const refresh = () => {
    api.tags().then(tags => dispatch({ type: 'loadOk', tags })).catch((e: Error) => dispatch({ type: 'loadErr', error: e.message }))
  }
  useEffect(() => { refresh() }, [])

  const handleExport = () => {
    const body: TagsExport = {
      mado: 'tags',
      version: 1,
      tags: tags.map(t => ({ name: t.name, color: t.color })),
    }
    downloadJson('mado-tags.json', body)
  }

  // 同名のタグは作り直さずスキップする (名前が UNIQUE で、色だけ違う場合に
  // 上書きすると既存の割り当ての見た目が黙って変わるため)。
  const handleImport = async (data: unknown, mode: ImportMode): Promise<ImportSummary> => {
    const d = data as Partial<TagsExport>
    if (d?.mado !== 'tags' || !Array.isArray(d.tags)) {
      throw new Error(translate('tagsSettings.thisIsNotAMadoTagExportFile'))
    }
    const existing = new Set(tags.map(t => t.name))
    const summary: ImportSummary = { added: 0, skipped: 0, removed: 0, failed: [] }

    // 置き換え = 同期。ファイルに無いタグを消す。
    // タグを消すと storage_tag_assignments の CASCADE でそのタグの割り当ても
    // 一緒に消える (呼び出し側で警告を出している)。
    if (mode === 'replace') {
      const wanted = new Set(d.tags.map(t => t?.name).filter((n): n is string => typeof n === 'string'))
      for (const t of tags) {
        if (wanted.has(t.name)) continue
        try {
          await api.deleteTag(t.id)
          summary.removed = (summary.removed ?? 0) + 1
          existing.delete(t.name)
        } catch (e) {
          summary.failed.push(`${t.name}: ${(e as Error).message}`)
        }
      }
    }
    for (const t of d.tags) {
      if (typeof t?.name !== 'string' || typeof t?.color !== 'string') {
        summary.failed.push(translate('tagsSettings.someItemsHaveNonStringNameOrColor'))
        continue
      }
      if (existing.has(t.name)) { summary.skipped++; continue }
      try {
        await api.createTag({ name: t.name, color: t.color })
        existing.add(t.name)
        summary.added++
      } catch (e) {
        summary.failed.push(`${t.name}: ${(e as Error).message}`)
      }
    }
    return summary
  }

  return (
    <section className="settings-column">
      <SettingsSectionHeader
        title={translate('tagsSettings.manageTags')}
        actions={
          <>
            <ImportExportButtons
              what={translate('tagsSettings.tags')}
              replaceWarning={translate('tagsSettings.assignmentsToDeletedTagsAreRemovedAutomaticallyCascading')}
              onExport={handleExport}
              onImport={handleImport}
              onDone={refresh}
            />
            <button type="button" className="button primary small" onClick={() => dispatch({ type: 'openAdd' })}>
              <Plus size={14} aria-hidden="true" />
              {translate('common.add')}</button>
          </>
        }
      />

      {loading && <p className="muted">{translate('common.loading')}</p>}
      {error && <p className="notice error">{localizeMessage(error)}</p>}

      {!loading && tags.length === 0 && (
        <p className="state-message">{translate('tagsSettings.noTagsYet')}</p>
      )}

      {tags.length > 0 && (
        <div className="table-scroll">
          <table className="tags-table">
            <thead>
              <tr>
                <th scope="col">{translate('tagsSettings.tags')}</th>
                <th scope="col" className="row-actions"><span className="sr-only">{translate('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {tags.map(tag => (
                <tr key={tag.id}>
                  <td><TagBadge tag={tag} /></td>
                  <td className="row-actions">
                    <span className="row-actions__buttons">
                      <button type="button" className="button small" onClick={() => dispatch({ type: 'openEdit', tag })}>
                        {translate('common.edit')}</button>
                      <button
                        type="button"
                        className="button small danger"
                        aria-label={translate('tagsSettings.delete', { value0: tag.name })}
                        onClick={() => dispatch({ type: 'openDelete', tag })}
                      >
                        {translate('common.delete')}</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <TagForm
          initialValue={{ name: '', color: '#888888' }}
          onSubmit={async v => { await api.createTag(v); dispatch({ type: 'closeModal' }); refresh() }}
          onCancel={() => dispatch({ type: 'closeModal' })}
        />
      )}
      {editing && (
        <TagForm
          initialValue={{ name: editing.name, color: editing.color }}
          onSubmit={async v => { await api.updateTag(editing.id, v); dispatch({ type: 'closeModal' }); refresh() }}
          onCancel={() => dispatch({ type: 'closeModal' })}
        />
      )}
      {deleting && (
        <DeleteConfirm
          tag={deleting}
          onConfirm={async () => { await api.deleteTag(deleting.id); dispatch({ type: 'closeModal' }); refresh() }}
          onCancel={() => dispatch({ type: 'closeModal' })}
        />
      )}
    </section>
  )
}
