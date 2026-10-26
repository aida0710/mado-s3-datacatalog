import type { z } from 'zod'
import type { ApiErrorCode } from '../shared/api-error-codes.js'
import type { ServiceKeyScope } from '../shared/access-token-permissions.js'

// OpenAPI の文書 (docs/openapi.json) を作るための、ルート 1 つの書き方。
// 一覧は route-catalog.ts にあり、テストが Hono の app.routes と突き合わせる。

export type HttpMethod = 'get' | 'head' | 'post' | 'put' | 'patch' | 'delete'

/** だれが呼べるか。文書の security と、どのルートにも共通するエラーをここから決める。 */
export type RouteAccess =
  // 認証なし: 稼働確認、ログインの方法、ログインの流れ。
  | { kind: 'public' }
  // ブラウザのログイン (session cookie) だけ。トークンでは使えない。
  | { kind: 'session' }
  // /api/internal/*: session cookie か、機能別の権限を持つアクセストークン。
  // 必要な権限は lib/internal-api-permission-policy.ts から引き、文書の x-mado-permission に書く。
  | { kind: 'internal' }
  // 連携用の API: アクセストークン (Bearer) だけ。scope が無ければ scope を問わない。
  | { kind: 'integrationToken'; scope?: ServiceKeyScope }

/** JSON でない本文: ファイルの中身、テキスト、NDJSON のストリーム、リダイレクト。 */
export interface NonJsonContent {
  contentType: string
  description: string
}

export type SuccessStatus = 200 | 201 | 202 | 204 | 206 | 302 | 303
export type ResponseContent = z.ZodType | NonJsonContent | null

/** そのルートに特有のエラー。認証・入力の形など、どのルートにもあるものは access と入力から足す。 */
export interface RouteError {
  status: number
  code: ApiErrorCode
}

/**
 * ルート 1 つ。path は Hono の書き方 (`/api/internal/connections/:id`) のままにし、
 * テストが app.routes と変換なしで比べられるようにする。
 */
export interface ApiRoute {
  method: HttpMethod
  path: string
  tag: string
  summary: string
  access: RouteAccess
  query?: z.ZodType
  body?: z.ZodType | NonJsonContent
  responses: Partial<Record<SuccessStatus, ResponseContent>>
  errors?: readonly RouteError[]
}

export function routeError(status: number, ...codes: ApiErrorCode[]): RouteError[] {
  return codes.map(code => ({ status, code }))
}

export function isNonJsonContent(content: unknown): content is NonJsonContent {
  // zod のスキーマは `_zod` に中身を持つ。NonJsonContent はただのオブジェクト。
  return typeof content === 'object' && content !== null && 'contentType' in content && !('_zod' in content)
}
