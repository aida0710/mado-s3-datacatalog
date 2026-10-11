import { Fragment, type ReactNode } from 'react'
import type { japaneseMessages } from './ja'
import { getMessageTemplate, type InterpolationNames, type MessageKey } from './translate'
import { useLocale } from './useLocale'

interface Props<Key extends MessageKey> {
  message: Key
  count?: number
  values: Record<InterpolationNames<typeof japaneseMessages[Key]>, ReactNode>
}

// 文の中の強調やリンクを要素のまま保ち、語順は言語ごとの訳文に任せる。
export function TranslatedMessage<Key extends MessageKey>({ message, values, count }: Props<Key>) {
  useLocale()
  const template = getMessageTemplate(message, { ...values, count })
  const replacements: Record<string, ReactNode> = values
  return template.split(/(\{value\d+\})/g).map((part, index) => (
    <Fragment key={index}>
      {part.startsWith('{') ? replacements[part.slice(1, -1)] : part}
    </Fragment>
  ))
}
