import type { ApiErrorBody, ApiErrorCode } from '../shared/api-error-codes.js'

/**
 * エラー応答の本文を作る: `c.json(apiError('not_found', 'connection not found'), 404)`。
 * 文に入る値は横の項目に置き (`{ ...apiError(...), capability }`)、受け取る側が文を解析せずに読めるようにする。
 */
export function apiError(code: ApiErrorCode, error: string): ApiErrorBody {
  return { error, code }
}
