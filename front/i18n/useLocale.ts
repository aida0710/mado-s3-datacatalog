import { useLocale as useLocaleStore } from '@mado/design-system/react'
import { localeStore } from './locale'

/** この画面の表示言語。言語が替わると、呼び出した部品を描き直す。 */
export function useLocale() {
  return useLocaleStore(localeStore)
}
