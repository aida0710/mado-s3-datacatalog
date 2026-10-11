import { useMemo, type DependencyList } from 'react'
import { useLocale } from './useLocale'

/** 文言を含む値を memo する。呼び出し側の依存に加え、表示言語が替わったときにも作り直す。 */
export function useLocalizedMemo<Value>(calculate: () => Value, dependencies: DependencyList): Value {
  const { locale } = useLocale()
  // 依存は呼び出し側が並べ、辞書の言語だけをここで足す。
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  return useMemo(calculate, [...dependencies, locale])
}
