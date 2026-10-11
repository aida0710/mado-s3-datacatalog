import { useMemo, type DependencyList } from 'react'
import { useLocale } from './useLocale'

/** Recompute cached labels when their catalogs change, while preserving the caller's inputs. */
export function useLocalizedMemo<Value>(calculate: () => Value, dependencies: DependencyList): Value {
  const { locale } = useLocale()
  // The caller lists calculation dependencies; this hook adds the external catalog's locale.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return useMemo(calculate, [...dependencies, locale])
}
