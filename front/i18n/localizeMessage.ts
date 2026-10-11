import { englishMessages } from './en'
import { japaneseMessages } from './ja'
import { getLocale } from './locale'
import type { MessageKey } from './translate'

interface MessageTemplate {
  key: MessageKey
  pattern: RegExp
  names: string[]
}

const fixedMessages = new Map<string, MessageKey>()
const templates: MessageTemplate[] = []

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Recognize only complete application messages, never arbitrary fragments of user content.
for (const key of Object.keys(japaneseMessages) as MessageKey[]) {
  for (const catalog of [japaneseMessages, englishMessages]) {
    const message = catalog[key]
    const placeholders = [...message.matchAll(/\{(value\d+)\}/g)]
    if (placeholders.length === 0) {
      fixedMessages.set(message, key)
      continue
    }
    const names = placeholders.map(match => match[1])
    const pattern = message.split(/\{value\d+\}/g).map(escapePattern).join('(.*?)')
    templates.push({ key, pattern: new RegExp(`^${pattern}$`, 's'), names })
  }
}

/** Errors and notices can outlive the language in which they were first produced. */
export function localizeMessage(message: string): string
export function localizeMessage(message: string | null): string | null
export function localizeMessage(message: string | null): string | null {
  if (message === null) return null
  const catalog = getLocale() === 'ja' ? japaneseMessages : englishMessages
  const fixedKey = fixedMessages.get(message)
  if (fixedKey) return catalog[fixedKey]
  for (const template of templates) {
    const match = template.pattern.exec(message)
    if (!match) continue
    const values = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]))
    if (template.key === 'serverErrors.operationDisabled') {
      const capabilityKey = fixedMessages.get(values.value0)
      if (capabilityKey) values.value0 = catalog[capabilityKey]
    }
    return catalog[template.key].replace(/\{(value\d+)\}/g, (_, name: string) => values[name])
  }
  return message
}
