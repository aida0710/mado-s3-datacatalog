import type { z } from 'zod'
import {
  ApiError, apiErrorFromResponse, INVALID_RESPONSE_CODE, isApiError, NETWORK_ERROR_CODE, requestJson,
} from '@mado/design-system/http'
import { notifyUnauthorized } from './unauthorized-events'
import { translate } from '../../i18n/translate'

export const API_BASE = '/api/internal'

const HTTP_UNAUTHORIZED = 401

// 長 TTL のキャッシュを引く API が共通で受け取るオプション。
// onRevalidate を渡すと stale-while-revalidate になり、期限切れのキャッシュを
// 即返しつつ裏で再取得する。呼び出し側はこのコールバックに渡された Promise を
// await して新しい値で描き直し、その間 UI に「更新中」を出す (CacheBanner)。
// 渡さなければ従来通り、期限切れなら取得完了まで待つ。
export interface Revalidatable<T> {
  onRevalidate?: (fresh: Promise<T>) => void
}

// キャッシュキー作成。'|' は S3 のキー / prefix では出現しないため衝突しない。
export const cacheKey = (...parts: Array<string | number | null | undefined>): string =>
  parts.map(p => p ?? '').join('|')

export function buildUrl(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  }
  const qs = search.toString()
  return qs ? `${path}?${qs}` : path
}

/** `/storage/:connectionId`配下のAPIパス。 */
export function storagePath(connectionId: string, suffix: string): string {
  return `${API_BASE}/storage/${encodeURIComponent(connectionId)}${suffix}`
}

function withMessage(failure: ApiError, message: string): ApiError {
  return new ApiError({ status: failure.status, code: failure.code, details: failure.details, message })
}

/** sessionが無い・切れている、またはパスワードが違う（401）。 */
export function isUnauthorizedError(failure: unknown): failure is ApiError {
  return isApiError(failure) && failure.status === HTTP_UNAUTHORIZED
}

// sessionの後ろにあるAPIの401は、sessionが切れたこと。APIの文（`unauthorized`）では利用者に
// 何が起きたか伝わらないので、ログインし直す案内にする（AuthGateがログイン画面を重ねる）。
function withSessionExpiredMessage(failure: unknown): unknown {
  return isUnauthorizedError(failure)
    ? withMessage(failure, translate('http.yourSessionHasExpiredSignInAgainAnd'))
    : failure
}

// 画面側で起きた失敗にはAPIの文が無いので、画面の言語の文にする。どれも辞書の文なので、
// エラーを状態に持ったまま表示言語を切り替えてもlocalizeMessageが出し直せる。
function withScreenSideMessage(failure: unknown, url: string): unknown {
  if (!isApiError(failure)) return failure
  if (failure.code === NETWORK_ERROR_CODE) return withMessage(failure, translate('http.couldNotReachTheServer'))
  if (failure.code === INVALID_RESPONSE_CODE) {
    // 応答の形の違いはAPIと画面の食い違いで、利用者には直せない。どの項目が違うかは開発者向けに残す。
    console.error(failure.message)
    const path = new URL(url, window.location.origin).pathname
    return withMessage(failure, translate('http.theServerReturnedAnUnexpectedResponse', { value0: path }))
  }
  return failure
}

/**
 * sessionの後ろにあるAPIを呼び、本文を`schema`で確かめて返す。失敗はDSのApiErrorで、
 * messageはAPIの文（画面にそのまま出す）。401はAuthGateへ知らせ、ログインし直す案内にする。
 */
export async function requestApi<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  init?: RequestInit,
): Promise<z.infer<Schema>> {
  try {
    return await requestJson(url, { schema, init, onUnauthorized: notifyUnauthorized })
  } catch (failure) {
    throw withScreenSideMessage(withSessionExpiredMessage(failure), url)
  }
}

/**
 * 401を呼び出し側が自分で扱う/api/authのAPI。requestApiと違い、401をAuthGateへ知らせず、
 * messageもAPIの文のまま返す。呼び出し側はApiErrorのstatusで分ける。
 * - /api/auth/config: ログインより前に呼ぶ
 * - /api/auth/me: AuthGateがsessionの有無を確かめる本体。401は「ログインしていない」
 * - /api/auth/local/login: 401はパスワードの誤り
 * - /api/auth/logout: 401は「sessionはもう無い」
 */
export async function requestAuthApi<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  init?: RequestInit,
): Promise<z.infer<Schema>> {
  try {
    return await requestJson(url, { schema, init })
  } catch (failure) {
    throw withScreenSideMessage(failure, url)
  }
}

/**
 * 本文を自分で読む取得（ストリーム・Blob・HEAD）に使う。失敗の応答だけをApiErrorにして投げ、
 * 成功の応答はそのまま返す。401の扱いはrequestApiと同じ。
 */
export async function fetchApiResponse(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init)
  if (response.ok) return response
  if (response.status === HTTP_UNAUTHORIZED) notifyUnauthorized()
  const body: unknown = await response.json().catch(() => undefined)
  throw withSessionExpiredMessage(apiErrorFromResponse(response.status, response.statusText, body))
}
