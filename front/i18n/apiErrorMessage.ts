import { z } from 'zod'
import type { Capability } from '../lib/api/types'
import { japaneseMessages } from './ja'
import { fillMessage, fillTranslationSource, type MessageKey } from './translate'
import { rememberTranslationSource, type TranslationSource } from './translationSources'

// API のエラー応答の本文 (api/shared/api-error-codes.ts)。code の横の項目は文に入る値なので、捨てずに持つ。
const ApiErrorBody = z.looseObject({ error: z.string(), code: z.string() })
type ApiErrorBody = z.infer<typeof ApiErrorBody>

// 辞書に `apiErrors.<code>` がある code は画面の言語の文で出す。無い code は API の英語の文をそのまま出す。
type ApiErrorMessageKey = Extract<MessageKey, `apiErrors.${string}`>
export type TranslatedApiErrorCode = ApiErrorMessageKey extends `apiErrors.${infer Code}` ? Code : never

const CAPABILITY_NAME_KEYS: Record<Capability, MessageKey> = {
  list: 'capabilityNames.list',
  preview: 'capabilityNames.preview',
  download: 'capabilityNames.download',
  archive: 'capabilityNames.archive',
  audioInfo: 'capabilityNames.audioInfo',
  audioSpectrogram: 'capabilityNames.audioSpectrogram',
  readmeRead: 'capabilityNames.readmeRead',
  readmeWrite: 'capabilityNames.readmeWrite',
}

function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && Object.hasOwn(CAPABILITY_NAME_KEYS, value)
}

// 差し込み位置のある文が、本文のどの項目から値を取るか。値が辞書の項目なら、言語を切り替えたときにその言語の文へ作り直す。
type MessageValue = string | { messageKey: MessageKey }

function capabilityName(capability: unknown): MessageValue {
  return isCapability(capability) ? { messageKey: CAPABILITY_NAME_KEYS[capability] } : String(capability)
}

const MESSAGE_VALUES: Partial<Record<TranslatedApiErrorCode, (body: ApiErrorBody) => Record<string, MessageValue>>> = {
  capability_disabled: body => ({ value0: capabilityName(body.capability) }),
  analysis_failed: body => ({ value0: String(body.reason ?? '') }),
}

function rememberedSource(key: ApiErrorMessageKey, messageValues: Record<string, MessageValue>): TranslationSource {
  const values: Record<string, string> = {}
  const messageKeyValues: Record<string, MessageKey> = {}
  for (const [name, value] of Object.entries(messageValues)) {
    if (typeof value === 'string') values[name] = value
    else messageKeyValues[name] = value.messageKey
  }
  return { key, values, messageKeyValues }
}

function isTranslatedCode(code: string): code is TranslatedApiErrorCode {
  return Object.hasOwn(japaneseMessages, `apiErrors.${code}`)
}

/**
 * API のエラー応答の本文から、今の言語で画面に出す文を作る。
 * API のエラーの形でない本文 (手前の proxy の HTML、空の本文) なら null を返し、呼び出し側が文を選ぶ。
 */
export function apiErrorMessage(body: unknown): string | null {
  const parsed = ApiErrorBody.safeParse(body)
  if (!parsed.success) return null
  const { code, error } = parsed.data
  if (!isTranslatedCode(code)) return error
  const key: ApiErrorMessageKey = `apiErrors.${code}`
  const messageValues = MESSAGE_VALUES[code]?.(parsed.data)
  if (!messageValues) return fillMessage(key, {})
  // translate() と同じく、値を差し込んだ文は出どころを覚え、言語を切り替えた後に localizeMessage が作り直せるようにする。
  const source = rememberedSource(key, messageValues)
  const text = fillTranslationSource(source)
  rememberTranslationSource(text, source)
  return text
}
