import { useState } from 'react'
import { accessTokensApi } from './api/accessTokens'
import { useRetryableLoad } from './useRetryableLoad'
import { namespaceChoices, NAMESPACE_MAX_COUNT } from './namespaceSelection'

export function useNamespaceSelection(input: { selected: string[]; onChange: (names: string[]) => void }) {
  const { state, retry } = useRetryableLoad(accessTokensApi.namespaces)
  const [query, setQuery] = useState('')
  const choices = namespaceChoices({ available: state.status === 'loaded' ? state.value.namespaces : [], selected: input.selected })
  const trimmedQuery = query.trim()
  const matches = choices.filter(name => name.toLowerCase().includes(trimmedQuery.toLowerCase()))
  const selectedNames = input.selected.filter(name => name !== '*')
  const allowsAll = input.selected.includes('*')
  const reachedLimit = selectedNames.length >= NAMESPACE_MAX_COUNT
  const canAddName = trimmedQuery !== '' && trimmedQuery !== '*' && !choices.includes(trimmedQuery)
  function toggleName(name: string) {
    if (input.selected.includes(name)) input.onChange(input.selected.filter(selected => selected !== name))
    else if (!reachedLimit) input.onChange([...input.selected, name])
  }
  function toggleAll() {
    input.onChange(allowsAll ? selectedNames : [...selectedNames, '*'])
  }
  function addName() {
    if (!canAddName || reachedLimit || allowsAll) return
    input.onChange([...selectedNames, trimmedQuery])
    setQuery('')
  }
  return { state, retry, query, setQuery, matches, selectedNames, allowsAll,
    reachedLimit, canAddName, trimmedQuery, toggleName, toggleAll, addName }
}
