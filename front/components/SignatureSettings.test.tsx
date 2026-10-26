import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../lib/auth-context'
import { AUTH_FIXTURE } from '../lib/auth-fixture'
import { SignatureSettings } from './SignatureSettings'

// /api/auth/profileの応答。保存したアカウントを返す。
function profileResponse(user: AuthContextValue['user']) {
  return new Response(JSON.stringify({ user }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => localStorage.clear())

describe('SignatureSettings', () => {
  it('アカウントの署名名が初期表示される', () => {
    render(<AuthContext.Provider value={AUTH_FIXTURE}><SignatureSettings /></AuthContext.Provider>)
    expect(screen.getByLabelText('署名名')).toHaveValue('tanaka')
  })

  it.each(['button', 'enter'])('%sで保存すると空白を除いた署名をアカウントへ保存する', async action => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(profileResponse(AUTH_FIXTURE.user))
    const reload = vi.fn()
    const user = userEvent.setup()
    render(<AuthContext.Provider value={{ ...AUTH_FIXTURE, reload }}><SignatureSettings /></AuthContext.Provider>)
    const input = screen.getByLabelText('署名名')
    fireEvent.change(input, { target: { value: '  sato  ' } })
    if (action === 'enter') await user.type(input, '{Enter}')
    else await user.click(screen.getByRole('button', { name: '保存' }))
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({
      body: JSON.stringify({ displayName: '田中', username: 'tanaka', signatureName: 'sato' }),
    }))
    expect(reload).toHaveBeenCalledOnce()
    expect(localStorage.length).toBe(0)
  })

  it('認証時はアカウント署名をAPIへ保存して再読込する', async () => {
    const reload = vi.fn().mockResolvedValue(undefined)
    const auth: AuthContextValue = {
      user: {
        id: '6f0f7b52-3c1e-4a0e-9d5b-2b7c1f0e8a11', username: 'aida', email: null, displayName: '相田',
        signatureName: '旧署名', roles: ['admin'], permissions: [], mustChangePassword: false, authMethods: ['local'],
      },
      logout: async () => {},
      reload,
    }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(profileResponse(auth.user))
    const user = userEvent.setup()
    render(<AuthContext.Provider value={auth}><SignatureSettings /></AuthContext.Provider>)

    const input = screen.getByLabelText('署名名')
    await user.clear(input)
    await user.type(input, '新しい署名')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ displayName: '相田', username: 'aida', signatureName: '新しい署名' }),
    }))
    expect(reload).toHaveBeenCalledOnce()
    expect(localStorage.length).toBe(0)
  })

  it('設定の末尾からサインアウトするとlogoutが呼ばれる', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    const auth: AuthContextValue = {
      user: {
        id: 'user-1', username: 'aida', email: null, displayName: '相田',
        signatureName: '相田', roles: ['admin'], permissions: [], mustChangePassword: false, authMethods: ['local'],
      },
      logout,
      reload: async () => {},
    }
    const user = userEvent.setup()
    render(<AuthContext.Provider value={auth}><SignatureSettings /></AuthContext.Provider>)

    expect(screen.getByRole('heading', { name: 'アカウントと署名の管理' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Account' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'サインアウト' }))
    expect(logout).toHaveBeenCalledOnce()
  })
})
