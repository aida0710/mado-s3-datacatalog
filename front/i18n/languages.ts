import type { Locale } from './locale'

// 今の表示言語によらず自分の言語を見つけられるよう、各言語はその言語での名前で出す。
export const LANGUAGES: ReadonlyArray<{ locale: Locale; name: string }> = [
  { locale: 'ja', name: '日本語' },
  { locale: 'en', name: 'English' },
]
