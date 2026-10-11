import type { Locale } from './locale'

// Native names let users find their language regardless of the current selection.
export const LANGUAGES: ReadonlyArray<{ locale: Locale; name: string }> = [
  { locale: 'ja', name: '日本語' },
  { locale: 'en', name: 'English' },
]
