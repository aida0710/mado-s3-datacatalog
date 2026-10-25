import { afterEach, describe, expect, it } from 'vitest'
import { getLocale, setLocale } from './locale'

afterEach(() => {
  localStorage.removeItem('mado.locale')
  setLocale('ja')
})

// 言語の決め方 (保存した言語 → ブラウザ → 英語) はデザインシステムが確かめる。ここでは保存キーだけを見る。
describe('表示言語', () => {
  it('選んだ言語を mado.locale に保存し、<html lang> に書く', () => {
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(localStorage.getItem('mado.locale')).toBe('en')
    expect(document.documentElement.lang).toBe('en')
  })
})
