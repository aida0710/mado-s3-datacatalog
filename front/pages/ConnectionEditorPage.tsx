import { useEffect, useReducer } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ConnectionForm } from '../components/ConnectionForm'
import { api } from '../lib/api/client'
import type { Connection } from '../lib/api/types'
import { invalidateCapabilitiesCache } from '../lib/useCapabilities'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

interface State {
  loading: boolean
  connection: Connection | null
  error: string | null
}

type Action =
  | { type: 'loaded'; connection: Connection }
  | { type: 'failed'; error: string }

function reducer(state: State, action: Action): State {
  if (action.type === 'loaded') return { loading: false, connection: action.connection, error: null }
  return { ...state, loading: false, error: action.error }
}

export default function ConnectionEditorPage() {
  useLocale()
  const { connectionId } = useParams<{ connectionId: string }>()
  const navigate = useNavigate()
  const creating = connectionId === undefined
  const [state, dispatch] = useReducer(reducer, {
    loading: !creating,
    connection: null,
    error: null,
  })

  useEffect(() => {
    if (creating) return
    let current = true
    api.listConnections()
      .then(connections => {
        if (!current) return
        const connection = connections.find(row => row.id === connectionId)
        if (!connection) throw new Error(translate('connectionEditorPage.connectionNotFound'))
        dispatch({ type: 'loaded', connection })
      })
      .catch((cause: Error) => {
        if (current) dispatch({ type: 'failed', error: cause.message })
      })
    return () => { current = false }
  }, [connectionId, creating])

  const done = () => {
    invalidateCapabilitiesCache()
    navigate('/settings/connections')
  }

  if (state.loading) return <p className="state-message">{translate('common.loading')}</p>
  if (state.error) return (
    <div>
      <p className="notice error" role="alert">{localizeMessage(state.error)}</p>
      <Link className="button" to="/settings/connections">{translate('connectionEditorPage.backToConnections')}</Link>
    </div>
  )

  const mode = creating
    ? { kind: 'create' as const, onSubmit: async (input: Parameters<typeof api.createConnection>[0]) => { await api.createConnection(input); done() } }
    : { kind: 'edit' as const, current: state.connection!, onSubmit: async (input: Parameters<typeof api.updateConnection>[1]) => { await api.updateConnection(connectionId!, input); done() } }

  return (
    <ConnectionForm
      mode={mode}
      presentation="page"
      onClose={() => navigate('/settings/connections')}
    />
  )
}
