import { describe, expect, it, vi } from 'vitest'
import { createAccessTokenNamespaceCatalog } from './access-token-namespaces.js'

describe('アクセストークンのNamespace一覧', () => {
  it('DataLineageと既存キーの名前をまとめ、重複と全対象の記号を除く', async () => {
    const catalog = createAccessTokenNamespaceCatalog({
      store: { listTokens: vi.fn().mockResolvedValue([{ namespaces: ['speech', '*', 'future-name'] }]) },
      marquez: { listNamespaces: vi.fn().mockResolvedValue(['podcast', 'speech']) },
    })
    expect(await catalog.listNamespaces()).toEqual({ namespaces: ['future-name', 'podcast', 'speech'], sourceStatus: 'ready' })
  })

  it('最初のページにない名前も次のページから取得する', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => `group-${index}`)
    const listNamespaces = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(['last-group'])
    const catalog = createAccessTokenNamespaceCatalog({ store: { listTokens: vi.fn().mockResolvedValue([]) }, marquez: { listNamespaces } })
    const response = await catalog.listNamespaces()
    expect(response.sourceStatus).toBe('ready')
    expect(response.namespaces).toHaveLength(1001)
    expect(response.namespaces).toContain('last-group')
    expect(listNamespaces).toHaveBeenNthCalledWith(2, { limit: 1000, offset: 1000 })
  })

  it('取得元が停止しても既存キーの名前を返し、不完全な一覧と知らせる', async () => {
    const catalog = createAccessTokenNamespaceCatalog({
      store: { listTokens: vi.fn().mockResolvedValue([{ namespaces: ['speech'] }]) },
      marquez: { listNamespaces: vi.fn().mockRejectedValue(new Error('private upstream details')) },
    })
    expect(await catalog.listNamespaces()).toEqual({ namespaces: ['speech'], sourceStatus: 'unavailable' })
  })

  it('DataLineageが未設定なら既存キーの名前だけを返す', async () => {
    const catalog = createAccessTokenNamespaceCatalog({ store: { listTokens: vi.fn().mockResolvedValue([{ namespaces: ['speech'] }]) }, marquez: null })
    expect(await catalog.listNamespaces()).toEqual({ namespaces: ['speech'], sourceStatus: 'unconfigured' })
  })
})
