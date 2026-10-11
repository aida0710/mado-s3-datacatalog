import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database } from 'lucide-react'
import { api } from '../../lib/api/client'
import type { StorageLineageResolution } from '../../lib/api/types'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

interface Props {
  connectionId: string
  bucket: string
  path: string
}

function lineageHref(namespace: string, name: string): string {
  const query = new URLSearchParams({ namespace, name })
  return `/lineage?${query.toString()}`
}

function versionHref(versionId: string): string {
  const query = new URLSearchParams({ mode: 'versions', versionId })
  return `/lineage?${query.toString()}`
}

function locationRelation(matchType: 'exact' | 'prefix'): string {
  return matchType === 'exact'
    ? translate('storageLineagePanel.thisLocationIsRegisteredAsStorage')
    : translate('storageLineagePanel.underARegisteredStorageLocation')
}

export function StorageLineagePanel({ connectionId, bucket, path }: Props) {
  useLocale()
  const requestKey = `${connectionId}\u0000${bucket}\u0000${path}`
  const [response, setResponse] = useState<{
    key: string
    resolution: StorageLineageResolution | null
  } | null>(null)

  useEffect(() => {
    let current = true
    api.lineageResolveLocation(connectionId, bucket, path).then(
      value => { if (current) setResponse({ key: requestKey, resolution: value }) },
      () => { if (current) setResponse({ key: requestKey, resolution: null }) },
    )
    return () => { current = false }
  }, [connectionId, bucket, path, requestKey])

  const resolution = response?.key === requestKey ? response.resolution : null

  if (!resolution || resolution.matches.length === 0) return null

  // .notice に近い区画 (左の線 + 淡い地)。README の補足として、その直後に置かれる。
  return (
    <aside className="storage-lineage" aria-label={translate('storageLineagePanel.datasetsAssociatedWithThisLocation')}>
      <span className="storage-lineage-label">
        <Database size={14} aria-hidden="true" />
        {translate('common.dataset')}</span>
      <div className="storage-lineage-matches">
        {resolution.matches.slice(0, 3).map(match => (
          <div className="storage-lineage-match" key={`${match.versionId}:${match.locationId}`}>
            <div className="storage-lineage-name">
              <strong>{match.displayName ?? match.name}</strong>
              <span className="muted">
                {locationRelation(match.matchType)}
                {match.versionCount > 1 ? translate('storageLineagePanel.version', { value0: match.version }) : ''}
              </span>
            </div>
            <div className="storage-lineage-actions">
              <Link className="link-button" to={versionHref(match.versionId)}>{translate('storageLineagePanel.viewProcessingLineage')}</Link>
              <Link className="link-button" to={lineageHref(match.namespace, match.name)}>{translate('storageLineagePanel.viewAllDatasets')}</Link>
            </div>
          </div>
        ))}
        {resolution.matches.length > 3 && (
          <span className="muted">{translate('common.additionalItems', { value0: resolution.matches.length - 3 })}</span>
        )}
      </div>
    </aside>
  )
}
