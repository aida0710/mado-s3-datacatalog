import { isApiError, jsonRequestInit } from '@mado/design-system/http'
import type { ApiErrorCode } from '../../../api/shared/api-error-codes'
import { StartJobOk, TransferEstimate } from './types'
import { API_BASE, buildUrl, requestApi, storagePath } from './http'

// 走査していないディレクトリの見積もりは、409 でこの code が返る。同じ 409 でも走査結果を
// 読めなかったとき (scan_result_unreadable) は、再走査を促すエラーとしてそのまま出す。
const DIRECTORY_NOT_SCANNED: ApiErrorCode = 'directory_not_scanned'

// 転送見積もり (spec: 2026-08-22-transfer-estimate-design.md)。
// 走査結果と接続設定だけから計算されるので S3 は叩かれない。
// 接続設定を変えると結果が変わるため TTLCache は通さない。
export const pricingClient = {
  /** 料金カタログの更新ジョブを投入する。**取得の完了は待たない** —
   *  呼び出し側が getJob でポーリングする。 */
  refreshPricing: () => requestApi(`${API_BASE}/pricing/refresh`, StartJobOk, jsonRequestInit('POST')),

  /** 走査済みディレクトリの移送見積もり。**まだ走査していなければ null**。 */
  estimate: async (connectionId: string, bucket: string, prefix: string) => {
    try {
      return await requestApi(buildUrl(storagePath(connectionId, '/estimate'), { bucket, prefix }), TransferEstimate)
    } catch (failure) {
      if (isApiError(failure) && failure.code === DIRECTORY_NOT_SCANNED) return null
      throw failure
    }
  },
}
