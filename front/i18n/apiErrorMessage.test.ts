import { afterEach, describe, expect, expectTypeOf, it } from 'vitest'
import { API_ERROR_CODES, type ApiErrorCode } from '../../api/shared/api-error-codes'
import { apiErrorMessage, type TranslatedApiErrorCode } from './apiErrorMessage'
import { japaneseMessages } from './ja'
import { setLocale } from './locale'
import { localizeMessage } from './localizeMessage'

afterEach(() => setLocale('ja'))

describe('API のエラー応答の文', () => {
  it('code で今の言語の文を選び、言語を切り替えても作り直せる', () => {
    setLocale('ja')
    const notScanned = apiErrorMessage({ error: 'this directory has not been scanned yet', code: 'directory_not_scanned' })
    const analysisFailed = apiErrorMessage({
      error: 'analysis failed: custom detail', code: 'analysis_failed', reason: 'custom detail',
    })
    const previewDisabled = apiErrorMessage({
      error: '"File previews" is disabled for this connection', code: 'capability_disabled', capability: 'preview',
    })
    expect([notScanned, analysisFailed, previewDisabled]).toEqual([
      'このディレクトリはまだ走査されていません',
      '解析できませんでした: custom detail',
      'この接続では「ファイルのプレビュー」が無効になっています',
    ])

    setLocale('en')
    expect([notScanned, analysisFailed, previewDisabled].map(message => localizeMessage(message))).toEqual([
      'This directory has not been scanned yet.',
      'Analysis failed: custom detail',
      '“File previews” is disabled for this connection.',
    ])
  })

  it('訳の無い code は API の英語の文をそのまま出す', () => {
    setLocale('ja')
    expect(apiErrorMessage({ error: 'user not found', code: 'not_found' })).toBe('user not found')
  })

  it('API のエラーの形でない本文には文を作らない', () => {
    for (const body of [null, 'Bad Gateway', { error: 'no code' }, { code: 'not_found' }]) {
      expect(apiErrorMessage(body)).toBeNull()
    }
  })

  it('辞書の apiErrors.* はどれも API が返す code に当たる', () => {
    expectTypeOf<TranslatedApiErrorCode>().toExtend<ApiErrorCode>()
    const translatedCodes = Object.keys(japaneseMessages)
      .filter(key => key.startsWith('apiErrors.'))
      .map(key => key.slice('apiErrors.'.length))
    expect(translatedCodes.filter(code => !(API_ERROR_CODES as readonly string[]).includes(code))).toEqual([])
  })
})
