import type { MiddlewareHandler } from 'hono'

// CSRF 防御: 書き込み系メソッドに対して Origin/Referer を許可リストと突き合わせる。
// 悪意ある別サイトがブラウザのセッションを使って変更要求を送るのを防ぐため、
// セッション認証の書き込みでは Origin を必須にする。
// /api/external/* は Bearer 認証で守られ、cron からの curl は Origin を送らないため対象外。
//
// ブラウザは fetch() に必ず Origin を付ける (file://、Worker 経由など限られた例外を除く)。
// Origin が無いリクエストは「ブラウザ由来ではない」= ハンドラ自身の責任、と整理し
// ここでは Referer フォールバックを試した上で、それも無ければ拒否する。

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function requireSafeOrigin(allowed: readonly string[]): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next()
    const got = c.req.header('Origin') ?? c.req.header('Referer') ?? ''
    const ok = allowed.some(o => got === o || got.startsWith(o + '/'))
    if (!ok) return c.json({ error: 'invalid origin' }, 403)
    return next()
  }
}
