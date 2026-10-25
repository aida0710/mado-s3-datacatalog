import type { MessageKey } from './translate'

export interface TranslationSource {
  key: MessageKey
  values: Record<string, string | number>
  // 差し込んだ値そのものが辞書の項目 (操作の名前など) のとき、その項目。作り直すときは今の言語の文にする。
  messageKeyValues?: Record<string, MessageKey>
}

// 状態に持ったまま言語が切り替わる通知・エラーは数件だが、値を差し込むラベルの描画でも記録する。
// ファイル名などの値ごとに文が増えるので、古いものから捨てて上限で抑える。
const MAX_TRANSLATION_SOURCES = 5000

const sourcesByText = new Map<string, TranslationSource>()

/** 値を差し込んで作った文の項目と値を覚え、言語を切り替えた後に同じ項目と値で作り直せるようにする。 */
export function rememberTranslationSource(text: string, source: TranslationSource): void {
  // 使い直した文を新しい側へ移し、上限を超えたら最も古い文から捨てる。
  sourcesByText.delete(text)
  sourcesByText.set(text, source)
  if (sourcesByText.size <= MAX_TRANSLATION_SOURCES) return
  const oldestText = sourcesByText.keys().next().value
  if (oldestText !== undefined) sourcesByText.delete(oldestText)
}

export function findTranslationSource(text: string): TranslationSource | undefined {
  return sourcesByText.get(text)
}
