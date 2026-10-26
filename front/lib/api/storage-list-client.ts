import type { z } from 'zod'
import { ListBuckets, StorageList } from './types'
import { LONG_CACHE_TTL_MS, TTLCache } from './cache'
import { buildUrl, cacheKey, getJson, storagePath, type Revalidatable } from './http'

// 応答の形が変わったら persistKey の版を上げ、古い形の保存分を読まないようにする。
const listCache = new TTLCache<z.infer<typeof StorageList>>(LONG_CACHE_TTL_MS, {
  persistKey: 'mado.cache.list.v3',
  // サーバーのTTLが切れる間際に受け取った応答を、ブラウザのキャッシュでさらに6時間
  // 延ばしてはならない。遅くともサーバーの期限までに取り直す。
  expiresAt: value => Date.parse(value.cache.expiresAt),
})
const bucketsCache = new TTLCache<z.infer<typeof ListBuckets>>(LONG_CACHE_TTL_MS, {
  persistKey: 'mado.cache.buckets.v2',
  expiresAt: value => Date.parse(value.cache.expiresAt),
})

const listCacheKey = (
  connectionId: string, bucket: string, prefix: string, recursive: boolean | undefined, cursor: string | undefined,
) => cacheKey('list', connectionId, bucket, prefix, recursive ? 'r' : '', cursor)

// バケット一覧とディレクトリ一覧。上流が遅いので localStorage まで永続化する。
export const storageListClient = {
  buckets: (
    connectionId: string,
    opts: { refresh?: boolean } & Revalidatable<z.infer<typeof ListBuckets>> = {},
  ) =>
    bucketsCache.get(
      cacheKey('buckets', connectionId),
      () => getJson(
        buildUrl(storagePath(connectionId, '/buckets'), { refresh: opts.refresh ? '1' : undefined }),
        ListBuckets,
      ),
      opts.onRevalidate,
    ),

  invalidateBuckets: (connectionId: string): void => {
    bucketsCache.invalidate(cacheKey('buckets', connectionId))
  },

  list: ({ connectionId, bucket, prefix, cursor, recursive, force, refresh, onRevalidate }: {
    connectionId: string
    bucket: string
    prefix: string
    /** 前のページの応答の nextCursor。最初のページは省く。 */
    cursor?: string
    recursive?: boolean
    /** force=true は「forward navigation で同じ cache key に到達して停滞する」現象の防衛。
     *  一部の S3 互換実装は ContinuationToken / 最終キーを進めずに返してくることがあり、
     *  そのとき同じ cursor で別ページを取りに行く想定の cache が衝突して前ページが返る。 */
    force?: boolean
    /** サーバー側 cache も飛ばして S3 から取り直す。 */
    refresh?: boolean
  } & Revalidatable<z.infer<typeof StorageList>>) => {
    // recursive フラグもキャッシュキーに含める (= 通常 list と再帰 list は別エントリ)。
    // prefix の後ろに置くので invalidateList の prefix-match invalidation はそのまま有効。
    const key = listCacheKey(connectionId, bucket, prefix, recursive, cursor)
    if (force) listCache.invalidate(key)
    return listCache.get(
      key,
      () => getJson(buildUrl(storagePath(connectionId, '/list'), {
        bucket,
        prefix,
        cursor,
        recursive: recursive ? '1' : undefined,
        refresh: refresh ? '1' : undefined,
      }), StorageList),
      onRevalidate,
    )
  },

  // 1 prefix のリスト全ページを破棄 (アップロード/削除や手動 refresh 後に呼ぶ)。
  invalidateList: (connectionId: string, bucket: string, prefix: string): void => {
    listCache.invalidatePrefix(cacheKey('list', connectionId, bucket, prefix))
  },

  // 該当キャッシュエントリが「いつ S3 から取得されたか」。null = 未取得 / 失敗 / invalidate 直後。
  // fetch 側と同じ引数で同じ cache key を組む。
  lastFetched: {
    list: ({ connectionId, bucket, prefix, cursor, recursive }: {
      connectionId: string; bucket: string; prefix: string; cursor?: string; recursive?: boolean
    }): Date | null => {
      const value = listCache.peek(listCacheKey(connectionId, bucket, prefix, recursive, cursor))
      return value ? new Date(value.cache.fetchedAt) : null
    },
    buckets: (connectionId: string): Date | null => {
      const value = bucketsCache.peek(cacheKey('buckets', connectionId))
      return value ? new Date(value.cache.fetchedAt) : null
    },
  },
}
