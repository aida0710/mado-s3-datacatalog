import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { useId, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { readJsonFile, summaryText, type ImportMode, type ImportSummary } from '../lib/jsonFile'
import { Dialog } from './Dialog'

// The compact result row shows a few causes; the summary carries the total failure count.
const MAX_IMPORT_FAILURE_MESSAGES = 3

interface Props {
  /** 対象名 (例: 接続 / タグ)。隠し input の aria-label に使う。
   *  1 画面に複数置くとボタン名だけでは区別がつかないため。 */
  what: string
  /** エクスポート押下時。ファイルの組み立てと保存は呼び出し側。 */
  onExport: () => void
  /** インポート。読み込んだ JSON と取り込み方法を受け取り、件数のまとめを返す。 */
  onImport: (data: unknown, mode: ImportMode) => Promise<ImportSummary>
  /** 置き換えを選んだときに追加で伝えたい影響 (連鎖削除など)。 */
  replaceWarning?: string
  /** 完了後に一覧を取り直す。 */
  onDone?: () => void
  exportLabel?: string
  importLabel?: string
}

// 接続 / タグ / タグ割り当てで共通のインポート・エクスポート導線。
// <input type="file"> は見た目を揃えにくいので隠し、ボタンから click() で開く。
// 結果はボタンの下に一行で出す (見出しの右に置かれるので、重い通知の枠は使わない)。
export function ImportExportButtons({
  what, onExport, onImport, onDone, replaceWarning,
  exportLabel = translate("importExportButtons.export"), importLabel = translate("importExportButtons.import"),
}: Props) {
  useLocale()
  const inputId = useId()
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ファイルを読んだ時点では実行せず、取り込み方法を選んでもらう。
  // 置き換えは既存を消すので、黙って走らせない。
  const [picked, setPicked] = useState<unknown | null>(null)

  const handleFile = async (file: File) => {
    setImportSummary(null)
    setError(null)
    try {
      setPicked(await readJsonFile(file))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const run = async (mode: ImportMode) => {
    const data = picked
    setPicked(null)
    setBusy(true)
    setImportSummary(null)
    setError(null)
    try {
      const summary = await onImport(data, mode)
      setImportSummary(summary)
      onDone?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const importError = error ? localizeMessage(error)
    : importSummary?.failed.slice(0, MAX_IMPORT_FAILURE_MESSAGES).map(message => localizeMessage(message)).join(' / ')

  return (
    <div className="import-export">
      <button type="button" className="button small" onClick={onExport} disabled={busy}>
        <Download size={14} aria-hidden="true" />
        {exportLabel}
      </button>
      <button
        type="button"
        className="button small"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        <Upload size={14} aria-hidden="true" />
        {busy ? translate("importExportButtons.importing") : importLabel}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label={translate("importExportButtons.import2", { value0: what })}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />
      {(importSummary || error) && (
        <p className="import-export__result">
          {importSummary && <span className="muted">{summaryText(importSummary)}</span>}
          {importError && <span className="import-export__error" role="alert">{importError}</span>}
        </p>
      )}

      {picked !== null && (
        <Dialog
          titleId={titleId}
          title={translate("importExportButtons.howToImport", { value0: what })}
          onClose={() => setPicked(null)}
          narrowLayout="sheet"
          footer={
            <>
              <button type="button" className="button" onClick={() => setPicked(null)}>{translate("common.cancel")}</button>
              <button type="button" className="button primary" onClick={() => void run('append')}>{translate("importExportButtons.append")}</button>
              <button type="button" className="button danger" onClick={() => void run('replace')}>{translate("importExportButtons.replace")}</button>
            </>
          }
        >
          <div className="dialog-body import-export__choices">
            <p>
              <strong>{translate("importExportButtons.append")}</strong> {" " + translate("importExportButtons.addItemsFromTheFileExistingItemsAre")}</p>
            <p>
              <strong>{translate("importExportButtons.replace")}</strong> {" " + translate("importExportButtons.matchTheContentsOfTheFile")}<strong>{translate("importExportButtons.existingItemsMissingFromTheFileWillBe")}</strong>
              {translate("importExportButtons.itemsPresentInBothAreKeptWithoutBeing")}</p>
            {replaceWarning && <p className="import-export__warning">{replaceWarning}</p>}
          </div>
        </Dialog>
      )}
    </div>
  )
}
