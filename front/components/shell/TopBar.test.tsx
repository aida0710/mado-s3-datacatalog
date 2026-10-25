import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../../lib/auth-context'
import { AUTH_FIXTURE } from '../../lib/auth-fixture'
import { TopBar } from './TopBar'

const navigation = {
  mode: 'sidebar' as const, canCollapse: true, toggleCollapsed: () => {}, width: 192, setWidth: () => {}, resetWidth: () => {},
}

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>
}

function renderTopBar(auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/storage']}>
        <TopBar navigation={navigation} />
        <Routes><Route path="*" element={<CurrentPath />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('TopBar', () => {
  it('頭文字の丸から、名前・メールと Account・Settings へのメニューを開き、項目で画面を移る', async () => {
    const user = userEvent.setup()
    renderTopBar({ ...AUTH_FIXTURE, user: { ...AUTH_FIXTURE.user!, displayName: 'Sample admin', email: 'admin@example.com' } })
    const avatar = screen.getByRole('button', { name: 'ユーザーメニュー' })
    expect(avatar).toHaveTextContent('SA')
    await user.click(avatar)
    const menu = screen.getByRole('menu', { name: 'ユーザーメニュー' })
    expect(menu).toHaveTextContent('Sample admin')
    expect(menu).toHaveTextContent('admin@example.com')
    await user.click(screen.getByRole('menuitem', { name: 'Account' }))
    expect(screen.getByTestId('path')).toHaveTextContent('/settings/account')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('サインアウトはユーザーメニューの項目から行う', async () => {
    const user = userEvent.setup()
    const logout = vi.fn(async () => {})
    renderTopBar({ ...AUTH_FIXTURE, logout })
    expect(screen.queryByRole('button', { name: 'サインアウト' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ユーザーメニュー' }))
    await user.click(screen.getByRole('menuitem', { name: 'サインアウト' }))
    expect(logout).toHaveBeenCalledOnce()
  })
})
