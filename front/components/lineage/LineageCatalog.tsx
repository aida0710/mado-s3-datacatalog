import { localizeMessage } from '../../i18n/localizeMessage'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'
import { Fragment, useEffect, useId, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search } from 'lucide-react'
import { api } from '../../lib/api/client'
import type { RegistryDatasetSummary } from '../../lib/api/types'
import { isFromRowControl } from '../../lib/rowClick'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 200

function datasetKey(dataset: RegistryDatasetSummary): string {
  return `${dataset.namespace}\u0000${dataset.name}`
}

interface Props {
  hasSelection: boolean
  onSelect: (dataset: RegistryDatasetSummary) => void
}

/**
 * 登録済みデータセットの一覧と検索。起点を選ぶと閉じる。
 * 640px 未満では説明とデータ形式を行の下に開く形にする (共通の部品の .responsive-table)。
 */
export function LineageCatalog({ hasSelection, onSelect }: Props) {
  useLocale()
  const [open, setOpen] = useState(!hasSelection)
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [offset, setOffset] = useState(0)
  const [openRows, setOpenRows] = useState<ReadonlySet<string>>(new Set())
  const detailIdPrefix = useId()
  const [response, setResponse] = useState<{
    key: string
    results: RegistryDatasetSummary[]
    total: number
    error: string | null
  } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0)
      setSubmitted(query.trim())
    }, SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  const expanded = open
  const requestKey = `${submitted}\u0000${offset}`

  useEffect(() => {
    if (!expanded) return
    let current = true
    api.lineageCatalog({ q: submitted, limit: PAGE_SIZE, offset }).then(
      response => {
        if (!current) return
        setResponse({ key: requestKey, results: response.results, total: response.totalCount, error: null })
      },
      (reason: Error) => {
        if (!current) return
        setResponse({ key: requestKey, results: [], total: 0, error: reason.message })
      },
    )
    return () => { current = false }
  }, [expanded, submitted, offset, requestKey])

  const currentResponse = response?.key === requestKey ? response : null
  const results = currentResponse?.results ?? []
  const total = currentResponse?.total ?? 0
  const error = currentResponse?.error ?? null
  const loading = expanded && currentResponse === null

  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + results.length, total)

  const select = (dataset: RegistryDatasetSummary) => {
    onSelect(dataset)
    setOpen(false)
  }
  const toggleRow = (key: string) => setOpenRows(current => {
    const next = new Set(current)
    if (!next.delete(key)) next.add(key)
    return next
  })

  return (
    <section className="lineage-catalog" aria-label={translate("lineageCatalog.registeredDatasets")}>
      <h2 className="lineage-catalog__heading">
        <button
          type="button"
          className="lineage-catalog__toggle"
          aria-expanded={expanded}
          onClick={() => setOpen(value => !value)}
        >
          {expanded
            ? <ChevronDown size={18} aria-hidden="true" />
            : <ChevronRight size={18} aria-hidden="true" />}
          {translate("lineageCatalog.browseAndSearchRegistry")}</button>
      </h2>

      {expanded && (
        <div className="lineage-catalog__body">
          <div className="lineage-toolbar">
            <label className="lineage-search-field">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">{translate("lineageCatalog.searchDatasets")}</span>
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={translate("lineageCatalog.podcastEnglishDialogueS3Dataset")}
                autoComplete="off"
              />
            </label>
            <span className="lineage-toolbar__status">{loading ? translate("common.searching") : translate("lineageCatalog.registered", { value0: total })}</span>
          </div>

          {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="state-message">{translate("lineageCatalog.noDatasetsMatchTheseConditions")}</p>
          )}
          {results.length > 0 && (
            <div className="table-scroll">
              <table className="responsive-table">
                <thead>
                  <tr>
                    <th scope="col">{translate("common.dataset")}</th>
                    <th scope="col" className="lineage-catalog__secondary">{translate("common.description")}</th>
                    <th scope="col" className="lineage-catalog__secondary">{translate("common.dataFormat")}</th>
                    <th scope="col" className="numeric">{translate("common.version")}</th>
                    <th scope="col" className="responsive-table-toggle lineage-catalog__row-toggle">
                      <span className="sr-only">{translate("common.showDetails")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((dataset, index) => {
                    const key = datasetKey(dataset)
                    const rowOpen = openRows.has(key)
                    const detailId = `${detailIdPrefix}-${index}`
                    const description = dataset.description ?? <span className="muted">{translate("lineageCatalog.noDescriptionRegistered")}</span>
                    const mediaType = dataset.mediaType ?? <span className="muted">{translate("lineageCatalog.dataFormatNotRegistered")}</span>
                    return (
                      <Fragment key={key}>
                        <tr
                          className="clickable-row"
                          onClick={event => { if (!isFromRowControl(event)) select(dataset) }}
                        >
                          <td>
                            <button type="button" className="link-button" onClick={() => select(dataset)}>
                              {dataset.displayName ?? dataset.name}
                            </button>
                            <small className="mono break-word">{dataset.namespace} / {dataset.name}</small>
                          </td>
                          <td className="lineage-catalog__secondary lineage-catalog__description">{description}</td>
                          <td className="lineage-catalog__secondary nowrap">{mediaType}</td>
                          <td className="numeric nowrap">{dataset.versionCount}{translate("common.items", { count: dataset.versionCount })}</td>
                          <td className="responsive-table-toggle lineage-catalog__row-toggle">
                            <button
                              type="button"
                              className="icon-button"
                              aria-expanded={rowOpen}
                              aria-controls={detailId}
                              aria-label={rowOpen ? translate("common.hideDetails") : translate("common.showDetails")}
                              title={rowOpen ? translate("common.hideDetails") : translate("common.showDetails")}
                              onClick={() => toggleRow(key)}
                            >
                              {rowOpen
                                ? <ChevronUp size={18} aria-hidden="true" />
                                : <ChevronDown size={18} aria-hidden="true" />}
                            </button>
                          </td>
                        </tr>
                        {rowOpen && (
                          <tr id={detailId} className="responsive-table-details lineage-catalog__details">
                            <td colSpan={3}>
                              <dl>
                                <div><dt>{translate("common.description")}</dt><dd>{description}</dd></div>
                                <div><dt>{translate("common.dataFormat")}</dt><dd>{mediaType}</dd></div>
                              </dl>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {results.length > 0 && (
            <div className="table-footer">
              <span>{start}–{end}</span>
              {total > PAGE_SIZE && (
                <span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={translate("lineageCatalog.previous")}
                    title={translate("lineageCatalog.previous")}
                    disabled={offset === 0 || loading}
                    onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}
                  ><ChevronLeft size={16} aria-hidden="true" /></button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={translate("lineageCatalog.next")}
                    title={translate("lineageCatalog.next")}
                    disabled={offset + results.length >= total || loading}
                    onClick={() => setOffset(value => value + PAGE_SIZE)}
                  ><ChevronRight size={16} aria-hidden="true" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
