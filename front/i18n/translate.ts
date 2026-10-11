import { englishMessages } from './en'
import { japaneseMessages } from './ja'
import { getLocale } from './locale'

export type MessageKey = keyof typeof japaneseMessages

export type InterpolationNames<Message extends string> =
  Message extends `${string}{${infer Name}}${infer Rest}` ? Name | InterpolationNames<Rest> : never

type TranslationArguments<Key extends MessageKey> =
  [InterpolationNames<typeof japaneseMessages[Key]>] extends [never]
    ? [values?: Record<string, string | number>]
    : [values: Record<InterpolationNames<typeof japaneseMessages[Key]>, string | number>]

/** Only named interpolation values are replaced; user text is never interpreted as markup. */
export function translate<Key extends MessageKey>(key: Key, ...args: TranslationArguments<Key>): string {
  const values: Record<string, string | number> = args[0] ?? {}
  const catalog = getLocale() === 'ja' ? japaneseMessages : englishMessages
  return catalog[key].replace(/\{(value\d+)\}/g, (placeholder, name: string) =>
    values[name] === undefined ? placeholder : String(values[name]),
  )
}
