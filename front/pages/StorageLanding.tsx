import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../lib/api/client'
import type { Connection } from '../lib/api/types'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

// Storage タブの入口。デフォルト接続 → created_at 最古 → 0 件なら空状態、へ振り分ける。
// 接続の切り替えは画面右上の CONN スイッチャーが担うため、選択画面はもう無い。
function pickConnection(list: Connection[]): Connection | null {
  return (
    list.find(c => c.isDefault)
    ?? [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0]
    ?? null
  )
}

export default function StorageLanding() {
  useLocale()
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.listConnections()
      .then(list => {
        const target = pickConnection(list)
        if (target) navigate(`/storage/${encodeURIComponent(target.id)}/`, { replace: true })
        else setEmpty(true)
      })
      .catch(e => setError((e as Error).message))
  }, [navigate])

  if (error) return <p className="notice error">{localizeMessage(error)}</p>
  if (!empty) return <p className="state-message">{translate('common.loading')}</p>
  return (
    <>
      <header className="page-header">
        <div><h1>{translate('section.storage')}</h1></div>
      </header>
      <div className="empty-state">
        <h2>{translate('storageLanding.noConnectionsYet')}</h2>
        <p>
          {translate('storageLanding.noS3CompatibleStorageHasBeenRegisteredHere')}<br />
          {translate('storageLanding.addOneFromTheSettingsPage')}</p>
        <Link className="button primary" to="/settings">
          <Plus size={16} aria-hidden="true" />
          {translate('common.addConnection')}</Link>
      </div>
    </>
  )
}
