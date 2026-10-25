import { useState } from 'react'
import { useQuery } from '@mado/design-system/react'
import { connectionsClient } from './api/connections-client'

export function useTokenConnectionSelection(input: { selected: string[]; onChange: (ids: string[]) => void }) {
  const connections = useQuery({ key: 'connections', load: () => connectionsClient.listConnections() })
  const [query, setQuery] = useState('')
  const selected = input.selected
  const available = connections.value ?? []
  // 消された接続や一時的に読めない接続も、利用者が外すまでは一覧に残す。
  const missing = selected.filter(id => id !== '*' && !available.some(connection => connection.id === id))
  const choices = [...available.map(({ id, name }) => ({ id, name })), ...missing.map(id => ({ id, name: id }))]
  const matches = choices.filter(connection => `${connection.name} ${connection.id}`.toLowerCase().includes(query.trim().toLowerCase()))
  const allowsAll = selected.includes('*')
  function toggle(id: string) {
    input.onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  }
  return { connections, query, setQuery, matches, allowsAll, toggle,
    toggleAll: () => input.onChange(allowsAll ? selected.filter(id => id !== '*') : [...selected, '*']) }
}
