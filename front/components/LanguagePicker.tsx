import { LanguagePicker as DesignSystemLanguagePicker } from '@mado/design-system/react'
import { localeStore } from '../i18n/locale'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

/** 表示言語の切り替え (デザインシステムの LanguagePicker)。上部バーに加え、ログイン前の画面でも使う。 */
export function LanguagePicker() {
  useLocale()
  return <DesignSystemLanguagePicker store={localeStore} label={translate('common.language')} />
}
