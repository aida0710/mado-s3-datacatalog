import { CODE_LANGUAGES, type CodeLanguage } from '@mado/design-system/code'
import { translate } from '../i18n/translate'

/**
 * 利用者が拡張子ごとに選んだ表示形式の保存キー (デザインシステムの useCodeLanguage に渡す)。
 * 同じ種類のファイルを次に開いたときも同じ形式で見せる。
 */
export const CODE_LANGUAGE_STORAGE_KEY = 'mado.codeLanguage'

/** 形式の名前。テキストとログは表示言語に合わせ、言語名は共通の表記を使う。 */
export function codeLanguageName(language: CodeLanguage): string {
  if (language === 'plaintext') return translate('useCodeLanguage.text')
  if (language === 'log') return translate('useCodeLanguage.log')
  return CODE_LANGUAGES.find(item => item.id === language)?.name ?? language
}
