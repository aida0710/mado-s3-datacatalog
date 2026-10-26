import { isNotFoundError, jsonRequestInit } from '@mado/design-system/http'
import { Job, OkResult, StartScanOk } from './types'
import { API_BASE, buildUrl, requestApi, storagePath } from './http'

// 走査ジョブ (spec: 2026-08-18-directory-scan-design.md)。
// 走査は重く状態をサーバーが持つので、TTLCache は通さない。
export const jobsClient = {
  startScan: (connectionId: string, bucket: string, prefix: string) =>
    requestApi(buildUrl(storagePath(connectionId, '/scan'), { bucket, prefix }), StartScanOk, jsonRequestInit('POST')),

  getJob: (id: number) => requestApi(`${API_BASE}/jobs/${id}`, Job),

  /** 最後に成功した走査結果。無ければ null。 */
  latestScan: async (connectionId: string, bucket: string, prefix: string) => {
    const dedupKey = `${connectionId}\n${bucket}\n${prefix}`
    try {
      return await requestApi(buildUrl(`${API_BASE}/jobs/latest`, { kind: 'storage.scan', dedupKey }), Job)
    } catch (failure) {
      if (isNotFoundError(failure)) return null
      throw failure
    }
  },

  cancelJob: async (id: number): Promise<void> => {
    await requestApi(`${API_BASE}/jobs/${id}/cancel`, OkResult, jsonRequestInit('POST'))
  },
}
