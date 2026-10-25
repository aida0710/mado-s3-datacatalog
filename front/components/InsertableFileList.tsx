// README 編集ページの左ペイン専用の軽量ファイルリスト。
//
// 現在の prefix の直下のエントリ (recursive: false) だけを 1 度取得して表示する。
// StorageBrowser から pagination / preview drawer / search を剥がした派生形と思えばよい。
//
// 行クリック → onInsert を発火 (親が Monaco の現在カーソル位置に挿入)。
// ディレクトリ行末尾の「開く」(矢印) → 内部 state で prefix を切替えてそのサブディレクトリの
// 中身に進む。上部のパン屑で上位階層に戻れる。

import { useEffect, useState } from 'react'
import { ChevronRight, File, Folder } from 'lucide-react'
import type { z } from 'zod'
import { api } from '../lib/api/client'
import type { StorageList } from '../lib/api/types'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

export interface InsertableEntry {
  /** 表示用のファイル/ディレクトリ basename (末尾スラッシュなし)。 */
  name: string
  /** ディレクトリなら true。 */
  isDir: boolean
  /** S3 上のフルキー (prefix を含む)。ディレクトリの場合は末尾に '/' あり。 */
  fullKey: string
}

interface Props {
  connectionId: string
  bucket: string
  /** 初期 prefix。内部 state でサブディレクトリへ潜れる。 */
  prefix: string
  onInsert: (entry: InsertableEntry) => void
}

type ListData = z.infer<typeof StorageList>

interface ListResult {
  connectionId: string
  bucket: string
  prefix: string
  data: ListData | null
  error: string | null
}

export function InsertableFileList({ connectionId, bucket, prefix: initialPrefix, onInsert }: Props) {
  useLocale()
  const [prefix, setPrefix] = useState(initialPrefix)
  // 応答を取得対象と一緒に保持する。prefix 切替時に effect 内で state を同期リセット
  // しなくても、旧ディレクトリの結果を新しい現在地へ一瞬表示せずに済む。
  const [result, setResult] = useState<ListResult>({
    connectionId: '',
    bucket: '',
    prefix: '',
    data: null,
    error: null,
  })
  const isCurrent = result.connectionId === connectionId && result.bucket === bucket && result.prefix === prefix
  const data = isCurrent ? result.data : null
  const error = isCurrent ? result.error : null

  useEffect(() => {
    let cancelled = false
    api.list({ connectionId, bucket, prefix, recursive: false })
      .then(data => {
        if (!cancelled) setResult({ connectionId, bucket, prefix, data, error: null })
      })
      .catch(e => {
        if (!cancelled) {
          setResult({ connectionId, bucket, prefix, data: null, error: (e as Error).message })
        }
      })
    return () => { cancelled = true }
  }, [connectionId, bucket, prefix])

  // パン屑: bucket → セグメントへ。最後のセグメントは現在地なのでボタンにしない。
  // prefix = 'docs/sub/' なら crumbs = ['docs', 'sub']
  const crumbs = prefix.split('/').filter(Boolean)

  const goTo = (idx: number) => {
    // idx === -1 → bucket ルート (prefix = '')
    if (idx < 0) { setPrefix(''); return }
    const next = crumbs.slice(0, idx + 1).join('/') + '/'
    setPrefix(next)
  }

  return (
    <div className="filelist">
      <nav className="breadcrumbs filelist__crumbs" aria-label={translate('insertableFileList.currentDirectory')}>
        <button
          type="button"
          className="filelist__crumb"
          onClick={() => goTo(-1)}
          disabled={crumbs.length === 0}
          title={translate('insertableFileList.goToRoot')}
        >
          {bucket}
        </button>
        {crumbs.map((seg, i) => (
          <span key={i} className="filelist__crumb-wrap">
            <span aria-hidden="true" className="filelist__crumb-sep">/</span>
            <button
              type="button"
              className="filelist__crumb"
              onClick={() => goTo(i)}
              disabled={i === crumbs.length - 1}
            >
              {seg}
            </button>
          </span>
        ))}
      </nav>

      {error ? (
        <p className="filelist__message filelist__error" role="alert">{localizeMessage(error)}</p>
      ) : !data ? (
        <p className="filelist__message muted">{translate('common.loading')}</p>
      ) : data.directories.length === 0 && data.files.length === 0 ? (
        <p className="filelist__message muted">{translate('common.noEntries')}</p>
      ) : (
        <ul className="filelist__rows">
          {data.directories.map(d => {
            // d は prefix を含むフルパス。末尾 '/' を剥がして basename を取る。
            const base = d.slice(prefix.length).replace(/\/$/, '')
            return (
              <li key={d} className="filelist__row filelist__row--dir">
                <button
                  type="button"
                  className="filelist__name"
                  onClick={() => onInsert({ name: base, isDir: true, fullKey: d })}
                  title={translate('insertableFileList.clickToInsertIntoTheContent')}
                >
                  <Folder size={14} aria-hidden="true" />
                  <span>{base}/</span>
                </button>
                <button
                  type="button"
                  className="icon-button filelist__open"
                  onClick={() => setPrefix(d)}
                  title={translate('insertableFileList.openThisDirectory')}
                  aria-label={translate('common.openPath', { value0: base })}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            )
          })}
          {data.files.map(f => {
            const base = f.key.slice(prefix.length)
            return (
              <li key={f.key} className="filelist__row filelist__row--file">
                <button
                  type="button"
                  className="filelist__name"
                  onClick={() => onInsert({ name: base, isDir: false, fullKey: f.key })}
                  title={translate('insertableFileList.clickToInsertIntoTheContent')}
                >
                  <File size={14} aria-hidden="true" />
                  <span>{base}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {data && (data.nextContinuation || data.nextStartAfter) && (
        <p className="filelist__hint muted">
          {translate('insertableFileList.moreEntriesAreAvailableNavigateFurtherIntoThe')}</p>
      )}
    </div>
  )
}
