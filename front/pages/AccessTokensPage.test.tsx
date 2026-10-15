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
  status: 'active', createdAt: '2026-10-15T00:00:00.000Z', expiresAt: null,
  regeneratedAt: null, lastUsedAt: null, revision: 1,
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('Access Tokens', () => {
  it('アカウントを別に作らず参照と送信を同じトークンで発行し、言語変更で入力を保つ', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'POST'
      ? response({ accessToken: token, token: 'fixture-not-a-real-credential' }, 201) : response({ tokens: [] }))
    render(<AccessTokensPage />)
    await screen.findByText('アクセストークンはありません。')
    await user.click(screen.getByRole('button', { name: 'アクセストークンを作成' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), 'ML Tracking')
    await user.type(within(dialog).getByRole('textbox', { name: '許可Namespace' }), 'speech, podcast')
    expect(within(dialog).getByRole('checkbox', { name: 'データセット参照' })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: 'DataLineageの送信' })).toBeChecked()
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    act(() => setLocale('en'))
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('ML Tracking')
    expect(within(dialog).getByRole('textbox', { name: 'Allowed namespaces' })).toHaveValue('speech, podcast')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Issue token' }))
    expect(await screen.findByText('fixture-not-a-real-credential')).toBeInTheDocument()
    const issued = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(issued[0]).toBe('/api/internal/access-tokens')
    expect(JSON.parse(String(issued[1]!.body))).toEqual({ name: 'ML Tracking', description: '',
      scopes: ['lineage:read', 'lineage:write'], namespaces: ['speech', 'podcast'], expiresAt: null })
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('fixture-not-a-real-credential')).not.toBeInTheDocument()
  })

  it('容量取得だけを選ぶ場合はNamespaceを送らず、全接続を読むことを説明する', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'POST'
      ? response({ accessToken: { ...token, scopes: ['metrics:read'], namespaces: [] }, token: 'fixture-capacity-value' }, 201)
      : response({ tokens: [] }))
    render(<AccessTokensPage />)
    await screen.findByText('アクセストークンはありません。')
    await user.click(screen.getByRole('button', { name: 'アクセストークンを作成' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('checkbox', { name: 'データセット参照' }))
    await user.click(within(dialog).getByRole('checkbox', { name: 'DataLineageの送信' }))
    await user.click(within(dialog).getByRole('checkbox', { name: '容量メトリクス取得' }))
    expect(within(dialog).queryByRole('textbox', { name: '許可Namespace' })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/全接続のバケット名・容量/)).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: '名前' }), 'Capacity')
    await user.click(within(dialog).getByRole('button', { name: '発行する' }))
    await screen.findByText('fixture-capacity-value')
    expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body)))
      .toMatchObject({ scopes: ['metrics:read'], namespaces: [] })
  })

  it('一覧から無効化と有効化を行い、再発行と削除は確認してから実行する', async () => {
    const user = userEvent.setup()
    let current: AccessToken | null = structuredClone(token)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
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
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'PATCH'
      ? response({ error: 'changed' }, 409) : response({ tokens: [token] }))
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
