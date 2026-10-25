import { ErrorNotice } from '@mado/design-system/react'
import { useTokenConnectionSelection } from '../lib/useTokenConnectionSelection'
import { translate } from '../i18n/translate'
import { useLocale } from '../i18n/useLocale'

export function TokenConnectionSelector({ selected, onChange, disabled }: {
  selected: string[]
  onChange: (ids: string[]) => void
  disabled: boolean
}) {
  useLocale()
  const selection = useTokenConnectionSelection({ selected, onChange })
  return <fieldset className="token-connections" disabled={disabled}>
    <legend>{translate('accessTokens.connections')}</legend>
    <p className="muted">{translate('accessTokens.connectionHelp')}</p>
    <label className="token-connections__option">
      <input type="checkbox" checked={selection.allowsAll} onChange={selection.toggleAll} />
      <span>{translate('accessTokens.allConnections')}</span>
    </label>
    <label className="field"><span>{translate('accessTokens.searchConnections')}</span>
      <input type="search" value={selection.query} onChange={event => selection.setQuery(event.target.value)}
        disabled={selection.allowsAll} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }} />
    </label>
    {selection.connections.loading && <p className="muted" role="status">{translate('common.loading')}</p>}
    <ErrorNotice message={selection.connections.error ? translate('accessTokens.connectionLoadFailed') : null}
      retry={selection.connections.reload} retryLabel={translate('common.retry')} />
    <div className="token-connections__list" role="group" aria-label={translate('accessTokens.connectionList')}>
      {selection.matches.map(connection => <label className="token-connections__option" key={connection.id}>
        <input type="checkbox" checked={selected.includes(connection.id)} disabled={selection.allowsAll}
          onChange={() => selection.toggle(connection.id)} />
        <span>{connection.name}<small className="muted">{connection.id}</small></span>
      </label>)}
      {selection.matches.length === 0 && !selection.connections.loading && <p className="muted">{translate('accessTokens.noConnections')}</p>}
    </div>
  </fieldset>
}
