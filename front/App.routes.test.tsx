import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./pages/HomePage', () => ({ default: () => <p>Home content</p> }))
vi.mock('./pages/SettingsPage', () => ({ default: () => <p>Settings content</p> }))
vi.mock('./components/shell/TopBar', () => ({ TopBar: () => null }))
vi.mock('./components/shell/NavigationSidebar', () => ({ NavigationSidebar: () => null }))
vi.mock('./components/BottomDock', () => ({ BottomDock: () => null }))

function CurrentLocation() {
  return <output aria-label="location">{useLocation().pathname}</output>
}

describe('画面URL', () => {
  it.each(['/access', '/access/users', '/access/tokens', '/unknown'])('%sを開くと転送せず見つからない旨を表示する', path => {
    render(<MemoryRouter initialEntries={[path]}><App /><CurrentLocation /></MemoryRouter>)
    expect(screen.getByText('見つかりません')).toBeInTheDocument()
    expect(screen.getByLabelText('location')).toHaveTextContent(path)
    expect(screen.queryByText('Settings content')).not.toBeInTheDocument()
  })

  it('現行のAccess URLを開くとSettingsを表示する', () => {
    render(<MemoryRouter initialEntries={['/settings/access/users']}><App /></MemoryRouter>)
    expect(screen.getByText('Settings content')).toBeInTheDocument()
  })
})
