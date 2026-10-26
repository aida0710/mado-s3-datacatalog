import { AuditEventPage } from '../../../api/shared/schemas/audit'
import { API_BASE, buildUrl, requestApi } from './http'

// 1 回に読む監査ログの件数。画面を埋める程度にして、続きは「さらに読み込む」で cursor から読む。
const AUDIT_PAGE_SIZE = 30

// 監査ログ (Settings > Access > Audit)。新しい順に、cursor で続きを読む。
export const auditClient = {
  /** cursor は前のページの応答の nextCursor。最初のページは省く。 */
  auditEvents: (cursor?: string) =>
    requestApi(buildUrl(`${API_BASE}/audit-events`, { limit: String(AUDIT_PAGE_SIZE), cursor }), AuditEventPage),
}
