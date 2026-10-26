import { englishMessages, singularEnglishMessages } from './en'
import { japaneseMessages } from './ja'
import { getLocale } from './locale'
import { rememberTranslationSource, type TranslationSource } from './translationSources'

export type MessageKey = keyof typeof japaneseMessages

export type InterpolationNames<Message extends string> =
  Message extends `${string}{${infer Name}}${infer Rest}` ? Name | InterpolationNames<Rest> : never

type TranslationArguments<Key extends MessageKey> =
  [InterpolationNames<typeof japaneseMessages[Key]>] extends [never]
    ? [values?: Record<string, string | number>]
    : [values: Record<InterpolationNames<typeof japaneseMessages[Key]>, string | number> & { count?: number }]

// 英語の単数形は、count を渡されたらそれで、無ければ最初の差し込み値 (件数を含む文) で選ぶ。
export function getMessageTemplate(key: MessageKey, values: Record<string, unknown> = {}): string {
  if (getLocale() === 'ja') return japaneseMessages[key]
  const countValue = values.count ?? values.value0
  const count = typeof countValue === 'number' ? countValue
    : typeof countValue === 'string' ? Number(countValue)
    : undefined
  return count === 1 ? singularEnglishMessages[key] ?? englishMessages[key] : englishMessages[key]
}

/** 名前の付いた差し込み位置だけを値で置き換える。利用者の文字列をマークアップとして解釈しない。 */
export function fillMessage(key: MessageKey, values: Record<string, string | number>): string {
  return getMessageTemplate(key, values).replace(/\{(value\d+)\}/g, (placeholder, name: string) =>
    values[name] === undefined ? placeholder : String(values[name]),
  )
}

/** 覚えておいた項目と値から、今の言語の文を作る。 */
export function fillTranslationSource(source: TranslationSource): string {
  return fillMessage(source.key, source.values)
}

export function translate<Key extends MessageKey>(key: Key, ...args: TranslationArguments<Key>): string {
  const values: Record<string, string | number> = args[0] ?? {}
  const text = fillMessage(key, values)
  // 値を差し込んだ文は出どころを覚え、状態に残った通知やエラーを、言語を切り替えた後に同じ項目と値で作り直せるようにする。
  if (args[0] !== undefined) rememberTranslationSource(text, { key, values: { ...values } })
  return text
}
