// 監査ログの応答: 成功した変更の記録を新しい順に、cursor で続きを読む。
import { z } from 'zod'

export const AuditEvent = z.object({
  /** int8 なので文字列で返す。 */
  id: z.string(),
  occurred_at: z.string(),
  request_id: z.string().nullable(),
  actor_type: z.string(),
  actor_user_id: z.string().nullable(),
  actor_service_account_id: z.string().nullable(),
  /** 操作者の表示名。ユーザーの表示名、トークンの名前、無ければ actor_type。 */
  actor_label: z.string(),
  action: z.string(),
  resource_type: z.string().nullable(),
  resource_id: z.string().nullable(),
  outcome: z.enum(['pending', 'success', 'denied', 'failure']),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
})

export const AuditEventPage = z.object({
  events: z.array(AuditEvent),
  /** 次のページの cursor。最後のページは null。 */
  nextCursor: z.string().nullable(),
})
