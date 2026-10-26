import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { api } from './client'
import { fetchApiResponse, requestApi, requestAuthApi } from './http'
import { subscribeUnauthorized } from './unauthorized-events'
import { setLocale } from '../../i18n/locale'

function respondWith(status: number, body: unknown = { error: 'unauthorized', code: 'authentication_required' }) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })))
}

const unsubscribers: Array<() => void> = []
function listenUnauthorized() {
  const listener = vi.fn()
  unsubscribers.push(subscribeUnauthorized(listener))
  return listener
}

const Note = z.object({ exists: z.boolean() })

afterEach(() => {
  for (const unsubscribe of unsubscribers.splice(0)) unsubscribe()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setLocale('ja')
})

describe('API の 401 の通知', () => {
  it('API が 401 を返すと、購読しているところへ知らせてからエラーにする', async () => {
    respondWith(401)
    const listener = listenUnauthorized()

    await expect(requestApi('/api/internal/notes/home', Note)).rejects.toMatchObject({ status: 401 })

    expect(listener).toHaveBeenCalledOnce()
  })

  it('401 以外の失敗では知らせない', async () => {
    const listener = listenUnauthorized()

    respondWith(403, { error: 'forbidden', code: 'forbidden', permission: 'storage:read' })
    await expect(requestApi('/api/internal/notes/home', Note)).rejects.toThrow('forbidden')
    respondWith(500, { error: 'boom', code: 'internal_error' })
    await expect(requestApi('/api/internal/notes/home', Note)).rejects.toThrow('boom')

    expect(listener).not.toHaveBeenCalled()
  })

  it('購読をやめたあとは知らせない', async () => {
    respondWith(401)
    const listener = vi.fn()
    const unsubscribe = subscribeUnauthorized(listener)
    unsubscribe()

    await expect(requestApi('/api/internal/notes/home', Note)).rejects.toThrow()

    expect(listener).not.toHaveBeenCalled()
  })

  it('404 や 409 を自分で扱う取得（走査結果・移送見積もり）でも 401 を知らせる', async () => {
    respondWith(401)
    const listener = listenUnauthorized()

    await expect(api.latestScan('c', 'b', 'p/')).rejects.toThrow('セッションが切れました')
    await expect(api.estimate('c', 'b', 'p/')).rejects.toThrow('セッションが切れました')

    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('本文を自分で読む取得でも、401 を知らせてログインし直す案内にする', async () => {
    respondWith(401)
    const listener = listenUnauthorized()

    await expect(fetchApiResponse('/api/internal/storage/c/preview/tar')).rejects.toThrow('セッションが切れました')

    expect(listener).toHaveBeenCalledOnce()
  })

  it('/api/auth のログイン・session の確認では 401 を知らせず、API の文のまま返す', async () => {
    respondWith(401, { error: 'invalid identifier or password', code: 'invalid_credentials' })
    const listener = listenUnauthorized()

    await expect(requestAuthApi('/api/auth/local/login', Note)).rejects.toThrow('invalid identifier or password')

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('エラーの文', () => {
  it('API の失敗は、どちらの言語の画面でも API の文をそのまま出す', async () => {
    for (const locale of ['ja', 'en'] as const) {
      setLocale(locale)
      respondWith(409, { error: 'this directory has not been scanned yet', code: 'directory_not_scanned' })
      await expect(requestApi('/api/internal/notes/home', Note)).rejects.toThrow('this directory has not been scanned yet')
    }
  })

  it('API の形でない失敗の本文は、HTTP の状態を文にする', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' })))

    await expect(fetchApiResponse('/api/internal/storage/c/preview/raw')).rejects.toThrow('HTTP 502 Bad Gateway')
  })

  it('通信の失敗は、画面の言語の文にする', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))

    setLocale('ja')
    await expect(requestApi('/api/internal/notes/home', Note)).rejects.toThrow('サーバーに接続できませんでした。')
    setLocale('en')
    await expect(requestApi('/api/internal/notes/home', Note)).rejects.toThrow('Could not reach the server.')
  })

  it('形の合わない応答は、どの API かを添えた画面の言語の文にし、違いの詳細は console に残す', async () => {
    respondWith(200, { exists: 'yes' })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(requestApi('/api/internal/notes/home', Note))
      .rejects.toThrow('サーバーの応答の形が想定と違います（/api/internal/notes/home）。')

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('exists'))
  })
})
