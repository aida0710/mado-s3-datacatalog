import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { decodePageCursor, encodePageCursor } from './page-cursor.js'

const Position = z.strictObject({ offset: z.number().int().min(0) })

describe('一覧の cursor', () => {
  it('位置を中身の見えない文字列にして読み戻し、同じ位置からは同じ文字列ができる', () => {
    const cursor = encodePageCursor({ offset: 40 })
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(cursor).toBe(encodePageCursor({ offset: 40 }))
    expect(decodePageCursor(cursor, Position)).toEqual({ offset: 40 })
  })

  it('base64url でない・JSON でない・形の違う cursor は null', () => {
    expect(decodePageCursor('%%%', Position)).toBeNull()
    expect(decodePageCursor(Buffer.from('not json').toString('base64url'), Position)).toBeNull()
    expect(decodePageCursor(encodePageCursor({ offset: -1 }), Position)).toBeNull()
    expect(decodePageCursor(encodePageCursor({ beforeId: 3 }), Position)).toBeNull()
  })
})
