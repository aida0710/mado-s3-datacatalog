import type { z } from 'zod'
import type { ApiErrorBody, ApiErrorCode } from '../shared/api-error-codes.js'

/**
 * エラー応答の本文を作る: `c.json(apiError('not_found', 'connection not found'), 404)`。
 * 文に入る値は横の項目に置き (`{ ...apiError(...), capability }`)、受け取る側が文を解析せずに読めるようにする。
 */
export function apiError(code: ApiErrorCode, error: string): ApiErrorBody {
  return { error, code }
}

/**
 * 入力の検証に落ちた本文を、項目ごとの理由を並べたinvalid_requestにする: `name: Too big: expected string to have <=32 characters`。
 * 画面はこの文を英語ならそのまま、日本語なら案内の後に括弧で添えて出すので、zodのissueのJSON（`error.message`）は渡さない。
 * zodの理由の文は入力の値を含まないので、秘密の項目でもそのまま返せる。
 */
export function invalidRequest(error: z.ZodError): ApiErrorBody {
  const reasons = error.issues.map(issue => `${issue.path.join('.') || 'body'}: ${issue.message}`)
  return apiError('invalid_request', reasons.join('; '))
}
