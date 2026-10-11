import { useRef, type FormEvent } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import type { LineageProjection } from '../../lib/api/types'
import type { LineageRouteState } from '../../lib/lineage/route'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

interface RootInput {
  rootKind: 'dataset' | 'job'
  namespace: string
  name: string
  versionId: string
}

interface Props {
  route: LineageRouteState
  loading: boolean
  onModeChange: (mode: LineageProjection) => void
  onApply: (input: RootInput) => void
  onDepthChange: (depth: number) => void
  onRefresh: () => void
}

// グラフの表示の切り替え (表示方法・表示範囲・更新) と、技術 ID での起点の指定。
// 技術 ID の入力欄はツールバーの下に重ねて開き、表示したら閉じる。
export function LineageToolbar({ route, loading, onModeChange, onApply, onDepthChange, onRefresh }: Props) {
  useLocale()
  const technicalRef = useRef<HTMLDetailsElement>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onApply({
      rootKind: route.mode === 'logical'
        ? (data.get('rootKind') === 'job' ? 'job' : 'dataset')
        : route.rootKind,
      namespace: route.mode === 'logical' ? String(data.get('namespace') ?? '') : route.namespace,
      name: route.mode === 'logical' ? String(data.get('name') ?? '') : route.name,
      versionId: String(data.get('versionId') ?? ''),
    })
    if (technicalRef.current) technicalRef.current.open = false
  }

  return (
    <div className="lineage-toolbar">
      <div className="lineage-segmented" role="group" aria-label={translate('lineageToolbar.dataLineageView')}>
        <button
          type="button"
          aria-pressed={route.mode === 'logical'}
          onClick={() => onModeChange('logical')}
        >
          {translate('lineageToolbar.allDatasets')}</button>
        <button
          type="button"
          aria-pressed={route.mode === 'versions'}
          onClick={() => onModeChange('versions')}
        >
          {translate('lineageToolbar.inputsOutputsAndProcessingHistory')}</button>
      </div>

      <label className="lineage-toolbar__item">
        <span>{translate('lineageToolbar.viewRange')}</span>
        <select value={route.depth} onChange={event => onDepthChange(Number(event.target.value))}>
          {[1, 2, 3, 4, 5, 6].map(depth => <option key={depth} value={depth}>{depth}</option>)}
        </select>
      </label>
      <button type="button" className="button small lineage-toolbar__button" onClick={onRefresh} disabled={loading}>
        <RefreshCw size={14} aria-hidden="true" className={loading ? 'spin' : undefined} />
        {loading ? translate('common.updating') : translate('common.update')}
      </button>

      <details ref={technicalRef} className="lineage-toolbar__menu">
        <summary>
          {translate('lineageToolbar.specifyTechnicalId')}<ChevronDown size={14} aria-hidden="true" />
        </summary>
        <form
          key={`${route.mode}|${route.rootKind}|${route.namespace}|${route.name}|${route.versionId}`}
          className="popover lineage-root-form"
          onSubmit={submit}
        >
          {route.mode === 'logical' ? (
            <>
              <label className="field">
                <span>{translate('common.type')}</span>
                <select name="rootKind" defaultValue={route.rootKind}>
                  <option value="dataset">{translate('common.dataset')}</option>
                  <option value="job">{translate('common.processing')}</option>
                </select>
              </label>
              <label className="field">
                <span>{translate('common.namespace')}</span>
                <input name="namespace" className="mono" defaultValue={route.namespace} placeholder="speech" />
              </label>
              <label className="field">
                <span>{translate('common.technicalName')}</span>
                <input name="name" className="mono" defaultValue={route.name} placeholder="callhome-raw" />
              </label>
            </>
          ) : (
            <label className="field">
              <span>{translate('lineageToolbar.versionId')}</span>
              <input name="versionId" className="mono" defaultValue={route.versionId} placeholder={translate('lineageToolbar.versionUuid')} />
            </label>
          )}
          <button type="submit" className="button primary">{translate('common.show')}</button>
        </form>
      </details>
    </div>
  )
}
