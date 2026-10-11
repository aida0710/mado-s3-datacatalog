// CacheBanner の取得時刻を、取得からの経過時間で色分けするための段階。
//
// 一覧や README は取得から数時間経つと S3 の最新状態とずれていることがあるが、
// 「6時間前」の文字を読むまで気づけなかった。色で一目に分かるようにする。
// 色そのものは styles/storage.css の --cache-age-* (ライト・ダーク) が持つ。within-1h には色を付けない。

import { translate } from '../i18n/translate'

/** 段階ごとの経過時間の上限。1・3・6・12・24 時間で区切る (2026-09-29 利用者と決定)。 */
const CACHE_AGE_LEVELS = [
  { level: 'within-1h', maxHours: 1, get label() { return translate("cacheAgeLevel.retrievedLessThan1HourAgo") } },
  { level: 'within-3h', maxHours: 3, get label() { return translate("cacheAgeLevel.retrieved13HoursAgo") } },
  { level: 'within-6h', maxHours: 6, get label() { return translate("cacheAgeLevel.retrieved36HoursAgo") } },
  { level: 'within-12h', maxHours: 12, get label() { return translate("cacheAgeLevel.retrieved612HoursAgo") } },
  { level: 'within-24h', maxHours: 24, get label() { return translate("cacheAgeLevel.retrieved1224HoursAgo") } },
] as const

const OVER_24H = { level: 'over-24h', get label() { return translate("cacheAgeLevel.retrievedAtLeast24HoursAgo") } } as const

export type CacheAgeLevel = (typeof CACHE_AGE_LEVELS)[number]['level'] | typeof OVER_24H.level

const MS_PER_HOUR = 3_600_000

/** 取得時刻が現在より後 (端末の時計のずれ) なら、いちばん新しい段階にする。 */
export function cacheAgeLevel(fetchedAt: Date, now: Date): { level: CacheAgeLevel; label: string } {
  const ageHours = (now.getTime() - fetchedAt.getTime()) / MS_PER_HOUR
  const found = CACHE_AGE_LEVELS.find(candidate => ageHours < candidate.maxHours)
  return found ?? OVER_24H
}
