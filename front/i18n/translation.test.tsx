import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { englishMessages } from './en'
import { japaneseMessages } from './ja'
import { setLocale } from './locale'
import { translate, type MessageKey } from './translate'
import { TranslatedMessage } from './TranslatedMessage'
import { localizeMessage } from './localizeMessage'
import { CAPABILITY_UI } from './connectionOptions'
import { fmtCacheAge } from '../lib/format'

afterEach(() => setLocale('ja'))

describe('localized application messages', () => {
  it('English covers every message and preserves its interpolation values', () => {
    expect(Object.keys(englishMessages).sort()).toEqual(Object.keys(japaneseMessages).sort())
    for (const key of Object.keys(japaneseMessages) as MessageKey[]) {
      expect(englishMessages[key], key).not.toMatch(/[ぁ-んァ-ン一-龯]/)
      const names = (value: string) => [...value.matchAll(/\{(value\d+)\}/g)].map(match => match[1]).sort()
      expect(names(englishMessages[key]), key).toEqual(names(japaneseMessages[key]))
    }
  })

  it('switches imported options and interpolates user text without altering it', () => {
    setLocale('ja')
    const japaneseLabel = CAPABILITY_UI[0].label
    setLocale('en')
    expect(CAPABILITY_UI[0].label).not.toBe(japaneseLabel)
    expect(translate('loginPage.continueWith', { value0: '研究チーム' })).toBe('Continue with 研究チーム')
  })

  it('reorders a sentence around inline markup when the language changes', () => {
    setLocale('ja')
    render(<TranslatedMessage message="cacheBanner.retrievedAt" values={{ value0: <time>12:34</time> }} />)
    expect(screen.getByText('12:34').parentElement).toHaveTextContent('12:34に取得した情報です')
    act(() => setLocale('en'))
    expect(screen.getByText('12:34').parentElement).toHaveTextContent('Retrieved at 12:34')
    expect(screen.getByText('12:34').tagName).toBe('TIME')
  })

  it('updates captured notices and known server errors while preserving unknown details', () => {
    setLocale('ja')
    const previousMessage = translate('http.yourSessionHasExpiredSignInAgainAnd')
    setLocale('en')
    expect(localizeMessage(previousMessage)).toBe(translate('http.yourSessionHasExpiredSignInAgainAnd'))
    expect(localizeMessage('このディレクトリはまだ走査されていません')).toBe('This directory has not been scanned yet.')
    expect(localizeMessage('解析できませんでした: custom detail')).toBe('Analysis failed: custom detail')
    expect(localizeMessage('この接続では「ファイルのプレビュー」が無効になっています')).toBe('“File previews” is disabled for this connection.')
    expect(localizeMessage('custom service detail')).toBe('custom service detail')
  })
})

it('uses singular English units for one minute ago', () => {
  setLocale('en')
  expect(fmtCacheAge(new Date('2026-10-11T00:00:00Z'), new Date('2026-10-11T00:01:00Z'))).toContain('1 minute ago')
})
