import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLocale, initialLocale, initializeLocale, setLocale } from './locale'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem('mado.locale')
  setLocale('ja')
})

describe('language preference', () => {
  it('a saved choice overrides the browser language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    localStorage.setItem('mado.locale', 'ja')
    expect(initialLocale()).toBe('ja')
  })

  it('uses the first supported browser language when the saved value is invalid', () => {
    localStorage.setItem('mado.locale', 'invalid')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'ja-JP', 'en-US'])
    expect(initialLocale()).toBe('ja')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'ja-JP'])
    expect(initialLocale()).toBe('en')
  })

  it('falls back to English for unsupported browser languages', () => {
    localStorage.removeItem('mado.locale')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR'])
    expect(initialLocale()).toBe('en')
  })

  it('falls back to English when the browser reports no language', () => {
    localStorage.removeItem('mado.locale')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('')
    expect(initialLocale()).toBe('en')
  })

  it('still switches language when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable') })
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    expect(initialLocale()).toBe('en')
    setLocale('en')
    initializeLocale()
    expect(getLocale()).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
