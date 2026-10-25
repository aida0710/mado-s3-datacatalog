import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

interface Props {
  pageIdx: number
  /** 訪問したページを読むときに渡した cursor。1 ページ目は undefined。 */
  history: readonly (string | undefined)[]
  hasNext: boolean
  cursorStuck: boolean
  loading: boolean
  isEmpty: boolean
  totalLabel: string
  entryCount: number
  onPrev: () => void
  onNext: () => void
  onGoto: (idx: number) => void
}

// 表の下の帯 (.table-footer): 左に現ページと件数、右に 前 / 訪問済みのページ番号 / 次。
// 再読み込みは表の上の CacheBanner が持つ (取得時刻と同じ場所に集約)。
// S3 は前方向 cursor しか返さないので任意ページジャンプは「訪問済み」のみ。
export function Pager({
  pageIdx, history, hasNext, cursorStuck, loading, isEmpty,
  totalLabel, entryCount, onPrev, onNext, onGoto,
}: Props) {
  useLocale()
  return (
    <>
      <div className="table-footer storage-pager">
        {/* 空のディレクトリのときは件数を出さない。 */}
        <span className="storage-pager-summary">
          {translate('pager.page')}{' '}{totalLabel}
          {!isEmpty && translate('pager.items', { value0: entryCount })}
        </span>
        <nav className="storage-pager-nav" aria-label={translate('pager.pagination')}>
          <button
            type="button"
            className="icon-button"
            onClick={onPrev}
            disabled={pageIdx === 0 || loading}
            aria-label={translate('common.previousPage')}
            title={translate('common.previousPage')}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>

          {history.map((_cursor, i) => {
            const current = i === pageIdx
            // history は後ろに足すだけで並べ替えないので、位置をそのままキーにできる。
            return (
              <button
                key={i}
                type="button"
                className="storage-pager-page"
                onClick={() => onGoto(i)}
                disabled={loading || current}
                aria-current={current ? 'page' : undefined}
              >
                {i + 1}
              </button>
            )
          })}

          <button
            type="button"
            className="icon-button"
            onClick={onNext}
            disabled={!hasNext || loading}
            aria-label={translate('common.nextPage')}
            title={translate('common.nextPage')}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      </div>

      {/* server が IsTruncated=true なのに cursor を進めずに返してきた場合の案内。
          よくある原因は ListObjects v2 を理解しないサーバ
          (V1 only の S3 互換実装) で、設定 → 接続 →
          ListObjects API バージョンを v1 に切り替えると直る。 */}
      {cursorStuck && (
        <p className="notice warning">
          <span>
            {translate('pager.cannotAdvanceTheServerReturnedTheSameCursor')}{' '}<strong>{translate('common.listObjectsApiVersion')}</strong>{' '}
            {translate('pager.to')}{' '}<span className="mono">v1</span> {translate('pager.inSettingsThisCanHappenWithV1Only')}</span>
        </p>
      )}
    </>
  )
}
