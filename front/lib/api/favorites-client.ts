import type { z } from 'zod'
import { jsonRequestInit } from '@mado/design-system/http'
import { FavoriteBuckets, OkResult } from './types'
import { SHORT_CACHE_TTL_MS, TTLCache } from './cache'
import { cacheKey, requestApi, storagePath } from './http'

const favoritesCache = new TTLCache<z.infer<typeof FavoriteBuckets>>(SHORT_CACHE_TTL_MS)

const favoritePath = (connectionId: string, bucket: string) =>
  storagePath(connectionId, `/favorites/${encodeURIComponent(bucket)}`)

// お気に入りバケット。DB 由来で他端末からの toggle も見えるよう短 TTL。
export const favoritesClient = {
  favorites: (connectionId: string) =>
    favoritesCache.get(cacheKey('favorites', connectionId), () =>
      requestApi(storagePath(connectionId, '/favorites'), FavoriteBuckets),
    ),

  invalidateFavorites: (connectionId: string): void => {
    favoritesCache.invalidate(cacheKey('favorites', connectionId))
  },

  addFavorite: async (connectionId: string, bucket: string): Promise<void> => {
    await requestApi(favoritePath(connectionId, bucket), OkResult, jsonRequestInit('PUT'))
    favoritesCache.invalidate(cacheKey('favorites', connectionId))
  },

  removeFavorite: async (connectionId: string, bucket: string): Promise<void> => {
    await requestApi(favoritePath(connectionId, bucket), OkResult, jsonRequestInit('DELETE'))
    favoritesCache.invalidate(cacheKey('favorites', connectionId))
  },
}
