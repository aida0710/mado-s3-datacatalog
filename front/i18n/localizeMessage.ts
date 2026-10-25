import { englishMessages, singularEnglishMessages } from './en'
import { japaneseMessages } from './ja'
import { getLocale } from './locale'
import { fillMessage, type MessageKey } from './translate'
import { findTranslationSource } from './translationSources'

interface MessageTemplate {
  key: MessageKey
  pattern: RegExp
  names: string[]
}

// サーバーが返す文言 (API の文言をそのまま辞書に写した項目) の接頭辞。値を含む文を型として照合するのはこれだけにする。
// 画面の項目まで型にすると、「{value0} 回」のような短い型が関係のない英語のエラー文の末尾に当たり、書き換えてしまう。
const SERVER_MESSAGE_KEY_PREFIXES = ['serverErrors.', 'transferWarnings.', 'lineageWarnings.', 'pricingNotes.']

const fixedMessages = new Map<string, MessageKey>()
const serverMessageTemplates: MessageTemplate[] = []

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isServerMessageKey(key: MessageKey): boolean {
  return SERVER_MESSAGE_KEY_PREFIXES.some(prefix => key.startsWith(prefix))
}

// 値を含まない文は、全文が一致したときだけ訳す。値を含む文は、サーバーの文言だけを型にする。
for (const key of Object.keys(japaneseMessages) as MessageKey[]) {
  for (const catalog of [japaneseMessages, englishMessages, singularEnglishMessages]) {
    const message = catalog[key]
    if (message === undefined) continue
    const placeholders = [...message.matchAll(/\{(value\d+)\}/g)]
    if (placeholders.length === 0) {
      if (catalog !== singularEnglishMessages) fixedMessages.set(message, key)
      continue
    }
    if (!isServerMessageKey(key)) continue
    const names = placeholders.flatMap(match => match[1] ?? [])
    const pattern = message.split(/\{value\d+\}/g).map(escapePattern).join('(.*?)')
    serverMessageTemplates.push({ key, pattern: new RegExp(`^${pattern}$`, 's'), names })
  }
}

function localizeServerMessage(message: string): string | null {
  const catalog = getLocale() === 'ja' ? japaneseMessages : englishMessages
  for (const template of serverMessageTemplates) {
    const match = template.pattern.exec(message)
    if (!match) continue
    // (.*?) は一致すれば必ず値を持つが、型の上では undefined を含むので空文字に寄せる。
    const values: Record<string, string> = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1] ?? '']))
    if (template.key === 'serverErrors.operationDisabled') {
      const capabilityKey = fixedMessages.get(values.value0 ?? '')
      if (capabilityKey) values.value0 = catalog[capabilityKey]
    }
    if (template.key === 'transferWarnings.ratesUnavailable') {
      // リージョンが分からないとき、サーバーはこの決まった文字列を入れてくる。
      const unknownRegionLabels = [japaneseMessages['connectionForm.unknown'], englishMessages['connectionForm.unknown']]
      if (unknownRegionLabels.includes(values.value0 ?? '')) values.value0 = catalog['connectionForm.unknown']
    }
    return fillMessage(template.key, values)
  }
  return null
}

/** 表示中のエラーやお知らせを今の言語で出し直す。作ったときの言語のまま画面に残るため。 */
export function localizeMessage(message: string): string
export function localizeMessage(message: string | null): string | null
export function localizeMessage(message: string | null): string | null {
  if (message === null) return null
  // 画面が値を差し込んで作った文は、覚えておいた項目と値から作り直す。型の照合より確実。
  const source = findTranslationSource(message)
  if (source) return fillMessage(source.key, source.values)
  const fixedKey = fixedMessages.get(message)
  if (fixedKey) return getLocale() === 'ja' ? japaneseMessages[fixedKey] : englishMessages[fixedKey]
  return localizeServerMessage(message) ?? message
}
