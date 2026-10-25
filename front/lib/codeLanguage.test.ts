import { describe, expect, it } from 'vitest'
import { codeLanguageName } from './codeLanguage'

describe('codeLanguageName', () => {
  it('テキストとログは表示言語で、ほかは共通の表記で出す', () => {
    expect(codeLanguageName('plaintext')).toBe('テキスト')
    expect(codeLanguageName('log')).toBe('ログ')
    expect(codeLanguageName('yaml')).toBe('YAML')
    expect(codeLanguageName('properties')).toBe('.env / properties')
  })
})
