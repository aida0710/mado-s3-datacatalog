import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { invalidRequest } from './api-error.js'

describe('invalidRequest', () => {
  const Body = z.object({ name: z.string().max(3), nested: z.object({ count: z.number() }) })

  it('検証に落ちた項目ごとに「項目: 理由」を並べ、zodのissueのJSONを返さない', () => {
    const parsed = Body.safeParse({ name: 'long name', nested: { count: 'x' } })
    expect(parsed.success).toBe(false)
    const body = invalidRequest(parsed.error!)
    expect(body.code).toBe('invalid_request')
    expect(body.error).toBe('name: Too big: expected string to have <=3 characters; nested.count: Invalid input: expected number, received string')
  })

  it('本文そのものが形に合わないときは項目の代わりにbodyと書く', () => {
    const parsed = Body.safeParse(null)
    expect(invalidRequest(parsed.error!).error).toBe('body: Invalid input: expected object, received null')
  })

  it('理由の文に入力の値を入れない（秘密の項目でも返せる）', () => {
    const parsed = z.object({ secretAccessKey: z.string().max(4) }).safeParse({ secretAccessKey: 'do-not-echo-this-secret' })
    expect(invalidRequest(parsed.error!).error).not.toContain('do-not-echo-this-secret')
  })
})
