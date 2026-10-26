import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../lib/auth-context'
import AdminPage from './AdminPage'

afterEach(() => vi.restoreAllMocks())

const auth: AuthContextValue = {
  user: {
    id: 'admin', username: 'admin', email: null, displayName: 'Admin', signatureName: 'Admin',
    roles: ['admin'], permissions: ['users:manage', 'service_accounts:manage', 'audit:read'],
    mustChangePassword: false, authMethods: ['local'],
  },
  logout: async () => {},
  reload: async () => {},
}

const AIDA_ID = '1b6e3f0a-5c2d-4e8f-9a7b-3c4d5e6f7a81'
const SATO_ID = '2c7f4a1b-6d3e-4f9a-8b8c-4d5e6f7a8b92'
const SSO_USER_ID = '3d8a5b2c-7e4f-4a0b-9c9d-5e6f7a8b9ca3'

type ManagedUserFixture = { id: string; username: string; email: string | null; displayName: string; status: 'active' | 'disabled'; roles: string[]; authMethods: Array<'local' | 'sso'> }

// GET /api/internal/usersの応答。APIの応答の形（署名・権限・パスワード変更の要否、SSOの対応表）を補う。
function usersResponse(users: ManagedUserFixture[], ssoRoleMapping: Record<string, string> = {}) {
  const fullUsers = users.map(user => ({ signatureName: user.displayName, permissions: [], mustChangePassword: false, ...user }))
  return new Response(JSON.stringify({ users: fullUsers, ssoRoleMapping }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// ユーザーを変える要求（PATCH・PUT）の応答。変えたユーザーを返す。
function userResponse(user: ManagedUserFixture) {
  return new Response(JSON.stringify({ user: { signatureName: user.displayName, permissions: [], mustChangePassword: false, ...user } }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

function CurrentLocation() {
  return <output aria-label="location">{useLocation().pathname}</output>
}

function renderAccessPage(path = '/settings/access/tokens') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        <CurrentLocation />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('AdminPage', () => {
  it('Users・Access Tokens・Auditを専用ページに分ける', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(usersResponse([]))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/users']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    const nav = screen.getByRole('navigation', { name: 'Access' })
    expect(nav).toHaveTextContent('Users')
    expect(nav).toHaveTextContent('Access Tokens')
    expect(nav).toHaveTextContent('Audit')
    expect(screen.queryByRole('heading', { name: 'ユーザーとAPIアクセスの管理' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Access' })).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'ユーザーを追加' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Local Users' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pipeline Service Accounts' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Viewer — 閲覧のみ' })).toBeInTheDocument()
    expect(screen.getByText('StorageとDataLineageを閲覧できます。')).toBeInTheDocument()
  })

  it('TokensのURLを開くとアクセストークン一覧を表示する', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ tokens: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    renderAccessPage()
    expect(await screen.findByText('アクセストークンはありません。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アクセストークンを作成' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/internal/access-tokens')
  })

  it.each(['/settings/access/service-accounts', '/settings/access/unknown'])('%sを開くと転送せず見つからない旨を表示する', path => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderAccessPage(path)
    expect(screen.getByText('見つかりません')).toBeInTheDocument()
    expect(screen.getByLabelText('location')).toHaveTextContent(path)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ユーザー行を展開して編集・再発行・削除を管理できる', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(usersResponse([{
      id: AIDA_ID, username: 'aida', email: 'aida@example.jp', displayName: '相田',
      status: 'active', roles: ['curator'], authMethods: ['local'],
    }]))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/users']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    // 行をクリックすると、その下に編集欄が開く。
    await userEvent.click(await screen.findByText('相田'))
    const form = screen.getByRole('form', { name: '相田を編集' })
    expect(within(form).getByLabelText('表示名')).toHaveValue('相田')
    expect(within(form).getByLabelText('ユーザーID（ログインID）')).toHaveValue('aida')
    expect(within(form).getByText('aida@example.jp')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'パスワードを再発行' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: '削除' })).toBeInTheDocument()

    // キーボードでは行の右端のボタンで開け閉めする。
    const toggle = screen.getByRole('button', { name: '詳細を閉じる' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle)
    expect(screen.queryByRole('form', { name: '相田を編集' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '詳細を表示' }))
    expect(screen.getByRole('form', { name: '相田を編集' })).toBeInTheDocument()
  })

  it('ユーザーの削除は確認のダイアログで確定してから送る', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'DELETE'
      ? new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : usersResponse([{
        id: AIDA_ID, username: 'aida', email: null, displayName: '相田',
        status: 'active', roles: ['curator'], authMethods: ['local'],
      }]))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/users']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await userEvent.click(await screen.findByText('相田'))
    await userEvent.click(within(screen.getByRole('form', { name: '相田を編集' })).getByRole('button', { name: '削除' }))
    const dialog = screen.getByRole('dialog', { name: 'ユーザーを削除' })
    expect(dialog).toHaveTextContent('相田を削除しますか？この操作は取り消せません。')
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/internal/users/${AIDA_ID}`, expect.objectContaining({ method: 'DELETE' }))

    await userEvent.click(within(dialog).getByRole('button', { name: '削除' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/internal/users/${AIDA_ID}`, expect.objectContaining({ method: 'DELETE' }),
    ))
    expect(await screen.findByText('相田を削除しました。')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ユーザーを名前・ユーザーID・メールアドレスと状態で絞り込める', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(usersResponse([
      { id: AIDA_ID, username: 'aida', email: 'aida@example.jp', displayName: '相田', status: 'active', roles: ['curator'], authMethods: ['local'] },
      { id: SATO_ID, username: 'sato', email: 'sato@example.jp', displayName: '佐藤', status: 'disabled', roles: ['viewer'], authMethods: ['local'] },
    ]))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/users']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await screen.findByText('相田')
    await userEvent.type(screen.getByRole('searchbox', { name: 'ユーザーを検索' }), 'SATO')
    expect(screen.queryByText('相田')).not.toBeInTheDocument()
    expect(screen.getByText('佐藤')).toBeInTheDocument()

    await userEvent.clear(screen.getByRole('searchbox', { name: 'ユーザーを検索' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '状態で絞り込む' }), 'active')
    expect(screen.getByText('相田')).toBeInTheDocument()
    expect(screen.queryByText('佐藤')).not.toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox', { name: 'ユーザーを検索' }), 'sato')
    expect(screen.getByText('条件に合うユーザーはいません。')).toBeInTheDocument()
  })

  it('SSOユーザーの権限を読み取り専用にしてAuthentikの対応表を表示する', async () => {
    const ssoUser: ManagedUserFixture = {
      id: SSO_USER_ID, username: 'sso-user', email: 'sso@example.jp', displayName: 'SSO User',
      status: 'active', roles: ['admin'], authMethods: ['sso'],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'PATCH'
      ? userResponse(ssoUser)
      : usersResponse([ssoUser], {
        'mado-users': 'viewer', 'mado-curators': 'curator',
        'mado-operators': 'operator', 'mado-admins': 'admin',
      }))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/users']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await userEvent.click(await screen.findByText('SSO User'))
    const details = screen.getByRole('form', { name: 'SSO Userを編集' })
    expect(within(details).getByLabelText(/^権限/)).toBeDisabled()
    expect(within(details).getByText('SSO側で管理されるため、Madoからは変更できません。')).toBeInTheDocument()

    const guidance = screen.getByText(/以下のAuthentikグループ/).closest('blockquote')!
    expect(guidance).toHaveTextContent('mado-users→Viewer — 閲覧のみ')
    expect(guidance).toHaveTextContent('mado-curators→Curator — 内容編集')
    expect(guidance).toHaveTextContent('mado-operators→Operator — ジョブ実行')
    expect(guidance).toHaveTextContent('mado-admins→Admin — すべて管理')

    await userEvent.click(within(details).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      `/api/internal/users/${SSO_USER_ID}`, expect.objectContaining({ method: 'PATCH' }),
    ))
    expect(fetch).not.toHaveBeenCalledWith(
      `/api/internal/users/${SSO_USER_ID}/roles`, expect.anything(),
    )
  })

  it('対応表が空ならSSOユーザーの権限もMadoで変更できる', async () => {
    // 保存でPATCHの応答を読んでからPUTへ進むので、変更の要求には変えたユーザーを返す。
    const ssoUser: ManagedUserFixture = {
      id: SSO_USER_ID, username: 'sso-user', email: 'sso@example.jp', displayName: 'SSO User',
      status: 'active', roles: ['viewer'], authMethods: ['sso'],
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'PATCH' || init?.method === 'PUT'
      ? userResponse(ssoUser)
      : usersResponse([ssoUser]))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/users']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    await userEvent.click(await screen.findByText('SSO User'))
    const details = screen.getByRole('form', { name: 'SSO Userを編集' })
    expect(within(details).getByLabelText(/^権限/)).toBeEnabled()
    expect(within(details).queryByText('SSO側で管理されるため、Madoからは変更できません。')).not.toBeInTheDocument()
    expect(screen.getByText('SSOユーザーの権限もMadoで管理します。Authentikはログインできるかどうかだけを決めます。')).toBeInTheDocument()

    await userEvent.selectOptions(within(details).getByLabelText(/^権限/), 'admin')
    await userEvent.click(within(details).getByRole('button', { name: '保存' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      `/api/internal/users/${SSO_USER_ID}/roles`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ roles: ['admin'] }) }),
    ))
  })

  it('Auditタブ直下で監査ログ見出しを重複させない', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      events: [{
        id: '1', occurred_at: '2026-08-26T00:00:00Z', request_id: null, actor_type: 'user', actor_user_id: null,
        actor_service_account_id: null, actor_label: 'Admin', action: 'user.update', resource_type: 'user',
        resource_id: AIDA_ID, outcome: 'success', ip_address: null, user_agent: null,
        details: { target: { displayName: 'Masaki' }, changes: [{ field: 'username', label: 'ユーザーID', before: 'aida', after: 'masaki' }] },
      }],
      nextCursor: null,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/settings/access/audit']}>
          <Routes><Route path="/settings/access/*" element={<AdminPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(await screen.findByRole('button', { name: '更新' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '監査ログ' })).not.toBeInTheDocument()
    expect(screen.getByText('時刻')).toBeInTheDocument()
    expect(screen.getByText('ユーザーを変更')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
    expect(screen.getByText('OK')).toHaveClass('status-badge')
    await userEvent.click(screen.getByText('ユーザーを変更'))
    expect(screen.getByText('aida')).toBeInTheDocument()
    expect(screen.getByText('masaki')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '詳細を閉じる' })).toHaveAttribute('aria-expanded', 'true')
  })
})
