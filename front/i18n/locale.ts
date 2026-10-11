export type Locale = 'en' | 'ja'

// Keep this preference separate from the standalone ML Tracking application.
const LOCALE_STORAGE_KEY = 'mado.locale'
const listeners = new Set<() => void>()

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ja'
}

export function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Private browsing can disable storage; language selection still works.
  }
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'ja'
  for (const language of navigator.languages ?? [navigator.language]) {
    const supported = language.split('-')[0]
    if (isLocale(supported)) return supported
  }
  return 'en'
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
    // The in-memory choice remains usable when storage is unavailable.
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
