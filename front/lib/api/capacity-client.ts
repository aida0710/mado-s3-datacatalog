import { CapacityOverview, CapacityPrefixHistory, CapacityScanResponse } from './types'
import { jsonRequestInit } from '@mado/design-system/http'
import { buildUrl, requestApi, storagePath } from './http'

// 接続内の全バケットの容量メトリクス。計測はサーバーの scheduler が持つので TTLCache は通さない。
export const capacityClient = {
  capacityOverview: (connectionId: string, days: number) =>
    requestApi(buildUrl(storagePath(connectionId, '/capacity'), { days: String(days) }), CapacityOverview),

  capacityPrefixHistory: ({ connectionId, bucket, prefix, days }: {
    connectionId: string
    bucket: string
    prefix: string
    days: number
  }) =>
    requestApi(
      buildUrl(storagePath(connectionId, '/capacity/prefix'), { bucket, prefix, days: String(days) }),
      CapacityPrefixHistory,
    ),

  startCapacityScan: (connectionId: string) =>
    requestApi(storagePath(connectionId, '/capacity/scan'), CapacityScanResponse, jsonRequestInit('POST')),
}
