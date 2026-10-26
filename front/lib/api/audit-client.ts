import { AuditEventPage } from '../../../api/shared/schemas/audit'
import { API_BASE, buildUrl, requestApi } from './http'

// 1回に読む監査ログの件数。画面を埋める程度にして、続きは「さらに読み込む」でcursorから読む。
const AUDIT_PAGE_SIZE = 30

// 監査ログ（Settings > Access > Audit）。新しい順に、cursorで続きを読む。
export const auditClient = {
  /** cursorは前のページの応答のnextCursor。最初のページは省く。 */
  auditEvents: (cursor?: string) =>
    requestApi(buildUrl(`${API_BASE}/audit-events`, { limit: String(AUDIT_PAGE_SIZE), cursor }), AuditEventPage),
}
