export type Locale = 'en' | 'ja'

// 単独で動く ML Tracking とは別の保存キーにする。
const LOCALE_STORAGE_KEY = 'mado.locale'
const listeners = new Set<() => void>()

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja'
}

// ブラウザから言語を取れない、または対応していない言語のときに使う。
const FALLBACK_LOCALE: Locale = 'en'

// 選んで保存した言語を優先し、無ければブラウザの優先言語を順に見る。
export function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // プライベートブラウズなどで保存先が使えなくても、言語の切り替えは動かす。
  }
  return browserLocale() ?? FALLBACK_LOCALE
}

function browserLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    const supported = language?.split('-')[0]
    if (isLocale(supported)) return supported
  }
  return null
}

let locale = initialLocale()

export function getLocale(): Locale {
  return locale
}

export function getIntlLocale(): string {
  return locale === 'ja' ? 'ja-JP' : 'en-US'
}

export function initializeLocale(): void {
  document.documentElement.lang = locale
}

function updateLocale(next: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = next
  if (next === locale) return
  locale = next
  listeners.forEach(listener => listener())
}

export function setLocale(next: Locale): void {
  updateLocale(next)
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
  } catch {
    // 保存できなくても、開いている間は選んだ言語のまま使える。
  }
}

function syncLocale(event: StorageEvent): void {
  if (event.key !== LOCALE_STORAGE_KEY && event.key !== null) return
  updateLocale(initialLocale())
}

export function subscribeLocale(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', syncLocale)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', syncLocale)
    }
  }
}
