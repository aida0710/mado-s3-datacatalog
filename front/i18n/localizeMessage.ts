import { englishMessages } from './en'
import { japaneseMessages } from './ja'
import { getLocale } from './locale'
import { fillTranslationSource, type MessageKey } from './translate'
import { findTranslationSource } from './translationSources'

// 値を含まない文は、全文が一致したときだけ訳す。値を含む文は、作ったときに覚えた項目と値から作り直す。
// APIのエラーはAPIの文のまま出し、お知らせはcodeで訳す（noticeMessages.ts）ので、ここで文の形を照合しない。
const fixedMessages = new Map<string, MessageKey>()

for (const key of Object.keys(japaneseMessages) as MessageKey[]) {
  for (const message of [japaneseMessages[key], englishMessages[key]]) {
    if (message !== undefined && !/\{value\d+\}/.test(message)) fixedMessages.set(message, key)
  }
}

/** 表示中のエラーやお知らせを今の言語で出し直す。作ったときの言語のまま画面に残るため。 */
export function localizeMessage(message: string): string
export function localizeMessage(message: string | null): string | null
export function localizeMessage(message: string | null): string | null {
  if (message === null) return null
  const source = findTranslationSource(message)
  if (source) return fillTranslationSource(source)
  const fixedKey = fixedMessages.get(message)
  if (fixedKey) return getLocale() === 'ja' ? japaneseMessages[fixedKey] : englishMessages[fixedKey]
  return message
}
