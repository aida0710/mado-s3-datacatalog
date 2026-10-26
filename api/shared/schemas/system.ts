// どのルートにも共通する応答: 稼働確認、エラー、成功だけを返す応答。
import { z } from 'zod'
import { API_ERROR_CODES } from '../api-error-codes.js'

/** `GET /healthz` の応答。DB に届かなければ 503 `database_unavailable`。 */
export const Health = z.strictObject({ status: z.literal('ok') })

/**
 * エラー応答。`error` は人が読む英語の文、`code` は理由の名前 (api-error-codes.ts)。
 * 文に入る値は横の項目に置く (`capability`、`reason` など) ので、ほかの項目も許す。
 */
export const ApiErrorBody = z.looseObject({ error: z.string(), code: z.enum(API_ERROR_CODES) })

/** 結果の値を持たない変更の応答。 */
export const OkResult = z.object({ ok: z.literal(true) })
