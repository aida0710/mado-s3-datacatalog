import { describe, expect, it } from 'vitest'
import { DEFAULT_TOKEN_EXPIRY_SELECTION } from '@mado/design-system/token-expiry'
import { initialTokenExpirySelection, isSameTokenExpirySelection } from './accessTokenForm'
import type { AccessToken } from '../types/accessTokens'

const token = { expiresAt: '2027-01-31T15:30:45.000Z' } as AccessToken

describe('期限の選択の最初の値', () => {
  it('作成は既定の90日、編集は今の期限 (日時か無期限) から始める', () => {
    expect(initialTokenExpirySelection(null)).toEqual(DEFAULT_TOKEN_EXPIRY_SELECTION)
    expect(initialTokenExpirySelection({ ...token, expiresAt: null }).option).toBe('never')
    const calendar = initialTokenExpirySelection(token)
    expect(calendar.option).toBe('calendar')
    expect(new Date(calendar.dateTime).getTime()).toBe(new Date('2027-01-31T15:30:00.000Z').getTime())
  })

  it('選び直していなければ同じとみなし、カレンダーは日時まで比べる', () => {
    const initial = initialTokenExpirySelection(token)
    expect(isSameTokenExpirySelection(initial, initial)).toBe(true)
    expect(isSameTokenExpirySelection({ ...initial, dateTime: '2027-02-01T00:00' }, initial)).toBe(false)
    expect(isSameTokenExpirySelection({ ...initial, option: '30' }, initial)).toBe(false)
  })
})
