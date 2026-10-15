import { useId } from 'react'
import { X } from 'lucide-react'
import { useNamespaceSelection } from '../lib/useNamespaceSelection'
import { NAMESPACE_MAX_COUNT, NAMESPACE_MAX_LENGTH } from '../lib/namespaceSelection'
import { translate } from '../i18n/translate'
import { useLocale } from '../i18n/useLocale'

export function NamespaceSelector({ selected, onChange, disabled }: {
  selected: string[]
  onChange: (names: string[]) => void
  disabled: boolean
}) {
  useLocale()
  const helpId = useId()
  const selection = useNamespaceSelection({ selected, onChange })
  const sourceStatus = selection.state.status === 'loaded' ? selection.state.value.sourceStatus : null
  return (
    <fieldset className="namespace-selection" disabled={disabled}>
      <legend>{translate('accessTokens.namespaces')}</legend>
      <p id={helpId} className="muted">{translate('accessTokens.namespaceHelp')}</p>
      <label className="namespace-selection__option">
        <input type="checkbox" checked={selection.allowsAll} onChange={selection.toggleAll} />
        <span>{translate('accessTokens.allNamespaces')}</span>
      </label>
      <label className="field namespace-selection__search">
        <span>{translate('accessTokens.searchNamespaces')}</span>
        <input type="search" value={selection.query} onChange={event => selection.setQuery(event.target.value)}
          disabled={selection.allowsAll} maxLength={NAMESPACE_MAX_LENGTH} aria-describedby={helpId} autoComplete="off"
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} />
      </label>
      <p className="muted" role="status">{selection.allowsAll ? translate('accessTokens.allNamespaces')
        : translate('accessTokens.selectedNamespaces', { value0: selection.selectedNames.length })}</p>
      {selection.selectedNames.length > 0 && <div className="namespace-selection__selected" role="group" aria-label={translate('accessTokens.selectedNamespaceList')}>
        {selection.selectedNames.map(name => <button type="button" className="button small" key={name}
          aria-label={translate('accessTokens.removeNamespace', { value0: name })} disabled={selection.allowsAll}
          onClick={() => selection.toggleName(name)}><span>{name}</span><X size={12} aria-hidden="true" /></button>)}
      </div>}
      {selection.state.status === 'loading' && <p className="muted" role="status">{translate('common.loading')}</p>}
      {selection.state.status === 'failed' && <p className="notice error" role="alert">{translate('accessTokens.namespaceLoadFailed')}
        <button type="button" className="button small" onClick={selection.retry}>{translate('loadFailedNotice.retry')}</button></p>}
      {sourceStatus && sourceStatus !== 'ready' && <p className="muted">{translate(sourceStatus === 'unconfigured'
        ? 'accessTokens.namespaceUnconfigured' : 'accessTokens.namespacePartial')}
        {sourceStatus !== 'unconfigured' && <button type="button" className="button small" onClick={selection.retry}>{translate('loadFailedNotice.retry')}</button>}
      </p>}
      <div className="namespace-selection__list" role="group" aria-label={translate('accessTokens.namespaceList')}>
        {selection.matches.map(name => <label className="namespace-selection__option" key={name}>
          <input type="checkbox" checked={selected.includes(name)}
            disabled={selection.allowsAll || (selection.reachedLimit && !selected.includes(name))}
            onChange={() => selection.toggleName(name)} />
          <span>{name}</span>
        </label>)}
        {selection.matches.length === 0 && selection.state.status !== 'loading' && <p className="muted">{translate('accessTokens.noNamespaces')}</p>}
      </div>
      {selection.canAddName && <button type="button" className="button small" disabled={selection.reachedLimit || selection.allowsAll}
        onClick={selection.addName}>{translate('accessTokens.addNamespace', { value0: selection.trimmedQuery })}</button>}
      {selection.reachedLimit && !selection.allowsAll && <p className="muted">{translate('accessTokens.namespaceLimit', { value0: NAMESPACE_MAX_COUNT })}</p>}
    </fieldset>
  )
}
