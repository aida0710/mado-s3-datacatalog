import { useState } from 'react'
import { connectionsClient } from './api/connections-client'
import { useRetryableLoad } from './useRetryableLoad'

export function useTokenConnectionSelection(input: { selected: string[]; onChange: (ids: string[]) => void }) {
  const { state, retry } = useRetryableLoad(connectionsClient.listConnections)
  const [query, setQuery] = useState('')
  const selected = input.selected
  const available = state.status === 'loaded' ? state.value : []
  // A deleted or temporarily unavailable connection stays visible until explicitly removed.
  const missing = selected.filter(id => id !== '*' && !available.some(connection => connection.id === id))
  const choices = [...available.map(({ id, name }) => ({ id, name })), ...missing.map(id => ({ id, name: id }))]
  const matches = choices.filter(connection => `${connection.name} ${connection.id}`.toLowerCase().includes(query.trim().toLowerCase()))
  const allowsAll = selected.includes('*')
  function toggle(id: string) {
    input.onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id])
  }
  return { state, retry, query, setQuery, matches, allowsAll, toggle,
    toggleAll: () => input.onChange(allowsAll ? selected.filter(id => id !== '*') : [...selected, '*']) }
}
