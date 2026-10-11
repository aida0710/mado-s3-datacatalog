import { Fragment, type ReactNode } from 'react'
import { englishMessages } from './en'
import { japaneseMessages } from './ja'
import type { InterpolationNames, MessageKey } from './translate'
import { useLocale } from './useLocale'

interface Props<Key extends MessageKey> {
  message: Key
  values: Record<InterpolationNames<typeof japaneseMessages[Key]>, ReactNode>
}

// Keep inline markup while allowing each language to choose the sentence's word order.
export function TranslatedMessage<Key extends MessageKey>({ message, values }: Props<Key>) {
  const { locale } = useLocale()
  const template = (locale === 'ja' ? japaneseMessages : englishMessages)[message]
  const replacements: Record<string, ReactNode> = values
  return template.split(/(\{value\d+\})/g).map((part, index) => (
    <Fragment key={index}>
      {part.startsWith('{') ? replacements[part.slice(1, -1)] : part}
    </Fragment>
  ))
}
