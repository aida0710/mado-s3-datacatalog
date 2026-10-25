import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccessTokensPage from './AccessTokensPage'
import { setLocale } from '../i18n/locale'
import type { AccessToken } from '../types/accessTokens'

afterEach(() => vi.restoreAllMocks())
const token: AccessToken = {
  id: '480ad940-80a2-4a50-8f6e-e0e119ac52a8', name: 'ML Tracking', description: 'Training integration',
  tokenPrefix: 'mado_lin_fixture', scopes: ['lineage:read', 'lineage:write'], namespaces: ['speech'],
  permissions: ['lineage:read', 'lineage:send'], connections: [],
  status: 'active', createdAt: '2026-10-15T00:00:00.000Z', expiresAt: null,
  regeneratedAt: null, lastUsedAt: null, revision: 1,
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function mockTokenRequests(handler: typeof globalThis.fetch) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) =>
    String(url).endsWith('/namespaces')
      ? response({ namespaces: ['speech', 'podcast'], sourceStatus: 'ready' })
      : String(url).endsWith('/connections') ? response([])
      : handler(url, init))
}

describe('Access Tokens', () => {
  it('新規作成は全権限が未選択で、機能の検索と編集・読み取りを別々に保存する', async () => {
    const user = userEvent.setup()
    const fetch = mockTokenRequests(async (_url, init) => init?.method === 'POST'
      ? response({ accessToken: { ...token, scopes: [], namespaces: [], permissions: ['notes:write'] }, token: 'fixture-internal-value' }, 201)
      : response({ tokens: [] }))
    render(<AccessTokensPage />)
    await user.click(screen.getByRole('button', { name: 'アクセストークンを作成' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByRole('checkbox').every(checkbox => !(checkbox as HTMLInputElement).checked)).toBe(true)
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), 'Notes automation')
    await user.click(within(dialog).getByRole('button', { name: '発行する' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('許可する操作を一つ以上選択してください')
    await user.type(within(dialog).getByRole('searchbox', { name: '機能を検索' }), 'notes')
    const notes = within(dialog).getByRole('group', { name: 'Notes' })
    expect(within(dialog).queryByRole('group', { name: 'Storage' })).not.toBeInTheDocument()
    await user.click(within(notes).getByRole('checkbox', { name: '編集' }))
    expect(within(notes).getByRole('checkbox', { name: '読み取り' })).not.toBeChecked()
    act(() => setLocale('en'))
    expect(within(notes).getByRole('checkbox', { name: 'Edit' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Issue token' }))
    await screen.findByText('fixture-internal-value')
    const saved = JSON.parse(String(fetch.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body))
    expect(saved).toMatchObject({ permissions: ['notes:write'], namespaces: [], connections: [] })
  })

  it('全接続の容量トークンは、名前だけ編集しても保存済みの権限と全接続をそのまま送る', async () => {
    const user = userEvent.setup()
    const capacity = { ...token, scopes: ['metrics:read'] as AccessToken['scopes'], namespaces: [],
      permissions: ['capacity:read'] as AccessToken['permissions'], connections: ['*'] }
    const fetch = mockTokenRequests(async (_url, init) => init?.method === 'PATCH'
      ? response({ accessToken: { ...capacity, revision: 2 } }) : response({ tokens: [capacity] }))
    render(<AccessTokensPage />)
    await user.click(within(await screen.findByRole('article', { name: token.name })).getByLabelText('ML Trackingの操作'))
    await user.click(screen.getByRole('button', { name: '編集' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), ' updated')
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const saved = JSON.parse(String(fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')![1]!.body))
    expect(saved).toMatchObject({ permissions: ['capacity:read'], connections: ['*'], namespaces: [] })
    expect(saved).not.toHaveProperty('scopes')
  })

  it('アカウントを別に作らず参照と送信を同じトークンで発行し、言語変更で入力を保つ', async () => {
    const user = userEvent.setup()
    const fetchMock = mockTokenRequests(async (_url, init) => init?.method === 'POST'
      ? response({ accessToken: token, token: 'fixture-not-a-real-credential' }, 201) : response({ tokens: [] }))
    render(<AccessTokensPage />)
    await screen.findByText('アクセストークンはありません。')
    await user.click(screen.getByRole('button', { name: 'アクセストークンを作成' }))
    const dialog = screen.getByRole('dialog')
    const lineage = within(dialog).getByRole('group', { name: 'DataLineage' })
    expect(within(lineage).getByRole('checkbox', { name: '読み取り' })).not.toBeChecked()
    expect(within(dialog).queryByText('連携APIの権限')).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'ML Tracking連携' }))
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), 'ML Tracking')
    await user.click(await within(dialog).findByRole('checkbox', { name: 'speech' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'podcast' }))
    expect(within(lineage).getByRole('checkbox', { name: '読み取り' })).toBeChecked()
    expect(within(lineage).getByRole('checkbox', { name: '送信' })).toBeChecked()
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    act(() => setLocale('en'))
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('ML Tracking')
    expect(within(dialog).getByRole('checkbox', { name: 'speech' })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: 'podcast' })).toBeChecked()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await user.click(within(dialog).getByRole('button', { name: 'Issue token' }))
    expect(await screen.findByText('fixture-not-a-real-credential')).toBeInTheDocument()
    const issued = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(issued[0]).toBe('/api/internal/access-tokens')
    expect(JSON.parse(String(issued[1]!.body))).toEqual({ name: 'ML Tracking', description: '',
      permissions: ['lineage:read', 'lineage:send'], connections: [], namespaces: ['speech', 'podcast'], expiresAt: null })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('fixture-not-a-real-credential')).not.toBeInTheDocument()
  })

  it('容量取得だけを選ぶ場合はNamespaceを送らず、接続を明示的に選んで発行する', async () => {
    const user = userEvent.setup()
    const fetchMock = mockTokenRequests(async (_url, init) => init?.method === 'POST'
      ? response({ accessToken: { ...token, scopes: ['metrics:read'], namespaces: [], permissions: ['capacity:read'], connections: ['*'] }, token: 'fixture-capacity-value' }, 201)
      : response({ tokens: [] }))
    render(<AccessTokensPage />)
    await screen.findByText('アクセストークンはありません。')
    await user.click(screen.getByRole('button', { name: 'アクセストークンを作成' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(within(dialog).getByRole('group', { name: 'Capacity' })).getByRole('checkbox', { name: '読み取り' }))
    expect(within(dialog).queryByRole('searchbox', { name: 'Namespaceを検索' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: 'すべての接続を許可' }))
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), 'Capacity')
    await user.click(within(dialog).getByRole('button', { name: '発行する' }))
    await screen.findByText('fixture-capacity-value')
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body)))
      .toMatchObject({ permissions: ['capacity:read'], namespaces: [], connections: ['*'] })
  })

  it('全Namespaceを明示的に選ぶと個別の名前を含めず全対象として発行する', async () => {
    const user = userEvent.setup()
    const fetch = mockTokenRequests(async (_url, init) => init?.method === 'POST'
      ? response({ accessToken: { ...token, namespaces: ['*'] }, token: 'fixture-all-namespaces-value' }, 201)
      : response({ tokens: [] }))
    render(<AccessTokensPage />)
    await user.click(screen.getByRole('button', { name: 'アクセストークンを作成' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), 'All groups')
    await user.click(within(dialog).getByRole('button', { name: 'ML Tracking連携' }))
    await user.click(await within(dialog).findByRole('checkbox', { name: 'speech' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'すべてのNamespaceを許可' }))
    await user.click(within(dialog).getByRole('button', { name: '発行する' }))
    await screen.findByText('fixture-all-namespaces-value')
    expect(JSON.parse(String(fetch.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body)).namespaces).toEqual(['*'])
  })

  it('一覧から無効化と有効化を行い、再発行と削除は確認してから実行する', async () => {
    const user = userEvent.setup()
    let current: AccessToken | null = structuredClone(token)
    const fetchMock = mockTokenRequests(async (url, init) => {
      if (!init?.method || init.method === 'GET') return response({ tokens: current ? [current] : [] })
      const saved = current!
      if (init.method === 'PATCH') current = { ...saved, ...JSON.parse(String(init.body)), revision: saved.revision + 1 }
      if (String(url).endsWith('/regenerate')) current = { ...saved, revision: saved.revision + 1 }
      if (init.method === 'DELETE') current = null
      return response({ accessToken: current ?? saved, ...(init.method === 'POST' ? { token: 'fixture-regenerated-value' } : {}) })
    })
    render(<AccessTokensPage />)
    const openActions = async () => user.click(within(await screen.findByRole('article', { name: token.name })).getByLabelText('ML Trackingの操作'))
    await openActions()
    await user.click(screen.getByRole('button', { name: '無効にする' }))
    await screen.findByText('無効', { exact: true })
    await openActions()
    await user.click(screen.getByRole('button', { name: '有効にする' }))
    await screen.findByText('有効', { exact: true })
    await openActions()
    await user.click(screen.getByRole('button', { name: '再発行' }))
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '再発行' }))
    await screen.findByText('fixture-regenerated-value')
    await user.click(screen.getByRole('button', { name: '閉じる' }))
    await openActions()
    await user.click(screen.getByRole('button', { name: '削除' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'キャンセル' }))
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0)
    await openActions()
    await user.click(screen.getByRole('button', { name: '削除' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '削除' }))
    await screen.findByText('アクセストークンはありません。')
    expect(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')![0])).toContain('expectedRevision=4')
  })

  it('保存に失敗したら入力を残し、再発行の値を表示しない', async () => {
    const user = userEvent.setup()
    mockTokenRequests(async (_url, init) => init?.method === 'PATCH'
      ? response({ error: 'changed', code: 'token_conflict' }, 409) : response({ tokens: [token] }))
    render(<AccessTokensPage />)
    await user.click(within(await screen.findByRole('article', { name: token.name })).getByLabelText('ML Trackingの操作'))
    await user.click(screen.getByRole('button', { name: '編集' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), ' changed')
    await user.click(within(dialog).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('別の操作でこのトークンが変更されました'))
    expect(within(dialog).getByRole('textbox', { name: '名前' })).toHaveValue('ML Tracking changed')
    expect(screen.queryByText(/この値は一度だけ表示されます/)).not.toBeInTheDocument()
  })
})
