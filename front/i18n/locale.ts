import { createLocaleStore } from '@mado/design-system/locale'

/**
 * この画面の表示言語。単独で動く mado ML Tracking とは別の保存キーにし、片方で選んだ言語がもう片方に
 * 移らないようにする。保存した言語 → ブラウザの優先言語 → 英語の順に決める (デザインシステム)。
 */
export const localeStore = createLocaleStore({ storageKey: 'mado.locale' })

// 辞書を引く処理 (translate・localizeMessage・format) は React の外で動くので、ストアの関数を直接使う。
export const { getLocale, getIntlLocale, setLocale } = localeStore
