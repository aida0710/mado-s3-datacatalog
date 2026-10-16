import { GetObjectCommand, NoSuchKey, S3Client } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pools } from '../db.js'
import type { RequestPrincipal } from '../lib/auth-types.js'
import { createTestAppWithPrincipal, testPrincipal } from '../lib/test-fixtures/request-principal.js'
import { mountNotesRoutes } from './notes.js'
import { mountStorageReadmeRoutes } from './storage-readme.js'

const storageMock = mockClient(S3Client)
afterEach(() => storageMock.reset())

function createEditorTestApp(principal: RequestPrincipal | null) {
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const connect = vi.fn().mockResolvedValue({ query, release: vi.fn() })
  const pools = { rw: { connect, query }, ro: { query } } as unknown as Pools
  const app = createTestAppWithPrincipal(principal)
  mountNotesRoutes(app, { pools })
  mountStorageReadmeRoutes(app, {
    pools, getStorage: async () => new S3Client({}),
    cache: { get: vi.fn(), set: vi.fn(), invalidateScope: vi.fn(), invalidateConnection: vi.fn() },
  })
  return { app, query, connect }
}

const edits = [
  { path: '/notes/home', body: { body: 'new' }, history: 'notes_history' },
  { path: '/storage/connection/readme', body: { bucket: 'bucket', prefix: '', body: 'new' }, history: 'storage_readme_history' },
]

describe.each(edits)('$pathの編集者', ({ path, body, history }) => {
  it.each(['Pretend user', '', null])('editor=%sを送ると書き込まず検証エラーになる', async editor => {
    const { app, connect } = createEditorTestApp(testPrincipal())
    const response = await app.request(path, { method: 'PUT', body: JSON.stringify({ ...body, editor }) })
    expect(response.status).toBe(400)
    expect(connect).not.toHaveBeenCalled()
    expect(storageMock.calls()).toHaveLength(0)
  })

  it('認証主体がなければ編集を拒否する', async () => {
    const { app, connect } = createEditorTestApp(null)
    expect((await app.request(path, { method: 'PUT', body: JSON.stringify(body) })).status).toBe(401)
    expect(connect).not.toHaveBeenCalled()
  })

  it.each<RequestPrincipal>([
    testPrincipal('Automation'),
    { kind: 'user', sessionId: 'session', user: {
      id: 'user', username: 'tanaka', email: null, displayName: 'Tanaka', signatureName: '田中',
      status: 'active', roles: [], permissions: [], mustChangePassword: false, authMethods: ['local'],
    } },
  ])('認証主体$kindで保存すると署名名かトークン名を履歴に記録する', async principal => {
    storageMock.on(GetObjectCommand).rejects(new NoSuchKey({ message: 'missing', $metadata: {} }))
    const { app, query } = createEditorTestApp(principal)
    expect((await app.request(path, { method: 'PUT', body: JSON.stringify(body) })).status).toBe(200)
    const historyWrite = query.mock.calls.find(([sql]) => sql.includes(`INSERT INTO ${history}`))
    expect(historyWrite?.[1].slice(-2)).toEqual(principal.kind === 'user'
      ? ['田中', 'user'] : ['Automation', null])
  })
})
