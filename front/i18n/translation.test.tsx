import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { englishMessages } from './en'
import { japaneseMessages } from './ja'
import { setLocale } from './locale'
import { translate, type MessageKey } from './translate'
import { TranslatedMessage } from './TranslatedMessage'
import { localizeMessage } from './localizeMessage'
import { CAPABILITY_UI } from './connectionOptions'
import { fmtCacheAge, fmtDurationRange } from '../lib/format'
import { itemAt } from '../tests/itemAt'

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
    const japaneseLabel = itemAt(CAPABILITY_UI, 0).label
    setLocale('en')
    expect(itemAt(CAPABILITY_UI, 0).label).not.toBe(japaneseLabel)
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

  it('updates captured notices while preserving unknown details', () => {
    setLocale('ja')
    const previousMessage = translate('http.yourSessionHasExpiredSignInAgainAnd')
    setLocale('en')
    expect(localizeMessage(previousMessage)).toBe(translate('http.yourSessionHasExpiredSignInAgainAnd'))
    expect(localizeMessage('custom service detail')).toBe('custom service detail')
  })

  it('rebuilds a captured notice from its key and values after the language changes', () => {
    setLocale('ja')
    const notice = translate('capacityMetricsPage.startedMeasuringBucketsResultsAppearAsEachMeasurement', { value0: '1' })
    setLocale('en')
    expect(localizeMessage(notice)).toBe(translate('capacityMetricsPage.startedMeasuringBucketsResultsAppearAsEachMeasurement', { value0: '1' }))
    setLocale('ja')
    expect(localizeMessage(notice)).toBe('1バケットの計測を開始しました。完了すると順次反映されます。')
  })

  it('leaves text that only resembles a short screen label unchanged', () => {
    for (const locale of ['ja', 'en'] as const) {
      setLocale(locale)
      expect(localizeMessage('object changed; retry the request')).toBe('object changed; retry the request')
      expect(localizeMessage('password was changed by another request')).toBe('password was changed by another request')
      expect(localizeMessage('Open the door')).toBe('Open the door')
      expect(localizeMessage('タイムアウトまで3日')).toBe('タイムアウトまで3日')
    }
  })

  it('uses singular count labels and duration units only for one item', () => {
    setLocale('en')
    expect(translate('common.items', { count: 0 })).toBe(' items')
    expect(translate('common.items', { count: 1 })).toBe(' item')
    expect(translate('common.items', { count: 2 })).toBe(' items')
    expect(translate('lineagePage.eventsArePendingSynchronization', { value0: 1 })).toBe('1 event is pending synchronization.')
    expect(fmtDurationRange(1, 1)).toBe('1 second')
    expect(fmtDurationRange(3600, 7200)).toBe('1–2 hours')
  })

  it('preserves inline markup while selecting singular messages after a language change', () => {
    setLocale('ja')
    render(<TranslatedMessage message="lineagePage.eventsArePendingSynchronization" count={1} values={{ value0: <strong>1</strong> }} />)
    act(() => setLocale('en'))
    expect(screen.getByText('1').parentElement).toHaveTextContent('1 event is pending synchronization.')
    expect(screen.getByText('1').tagName).toBe('STRONG')
  })

  it('translates API warnings in both directions without changing embedded values', () => {
    const retentionWarning = '最小保存期間 30 日。30 日以内に削除しても 30 日分は課金されます。'
    const lineageWarning = 'Skipped malformed Marquez node: 研究（A）、B〜C'
    setLocale('en')
    const englishRetentionWarning = localizeMessage(retentionWarning)
    expect(englishRetentionWarning).toBe('Minimum retention: 30 days. Deleting within 30 days still incurs charges for 30 days.')
    setLocale('ja')
    expect(localizeMessage(englishRetentionWarning)).toBe(retentionWarning)
    expect(localizeMessage(lineageWarning)).toBe('形式が不正なMarquezの項目を除外しました: 研究（A）、B〜C')
  })
})

it('uses singular English units for one minute ago', () => {
  setLocale('en')
  expect(fmtCacheAge(new Date('2026-10-11T00:00:00Z'), new Date('2026-10-11T00:01:00Z'))).toContain('1 minute ago')
})
