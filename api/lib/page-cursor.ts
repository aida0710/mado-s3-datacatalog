import type { z } from 'zod'

// 一覧の続きを指す `cursor` / `nextCursor`。mado ML Tracking と同じく、利用者には中身の見えない文字列にする。
// 中身は一覧ごとの位置 (S3 の続きのトークン、監査ログの ID、Registry の件数の位置) の JSON を base64url にしたもの。
// 同じ位置からは同じ文字列ができるので、画面は文字列の一致で「続きが進んでいない」ことを判定できる。

export function encodePageCursor(position: object): string {
  return Buffer.from(JSON.stringify(position)).toString('base64url')
}

/** 読めない・形の違う cursor は null。呼び出し側は 400 `invalid_cursor` を返す。 */
export function decodePageCursor<T>(cursor: string, schema: z.ZodType<T>): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
