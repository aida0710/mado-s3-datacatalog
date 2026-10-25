import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NavigationLinkList } from './NavigationLinkList'
import { isCurrentLink } from './navigationLinks'

function renderLinks({ path, showsTitles = false }: { path: string; showsTitles?: boolean }) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationLinkList showsTitles={showsTitles} />
    </MemoryRouter>,
  )
}

describe('NavigationLinkList', () => {
  it('今の画面のリンクに印を付ける', () => {
    renderLinks({ path: '/storage/demo/bucket/' })
    expect(screen.getByRole('link', { name: 'Storage' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('アイコンだけの列では名前をツールチップにする', () => {
    renderLinks({ path: '/', showsTitles: true })
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('title', 'Settings')
  })
})

describe('isCurrentLink', () => {
  it('Home はホームとノートの編集のときだけ、ほかは配下の画面でも選択中にする', () => {
    expect(isCurrentLink('/', '/')).toBe(true)
    expect(isCurrentLink('/', '/edit-note')).toBe(true)
    expect(isCurrentLink('/', '/storage')).toBe(false)
    expect(isCurrentLink('/storage', '/storage/demo/bucket/')).toBe(true)
    expect(isCurrentLink('/settings', '/settings-old')).toBe(false)
  })
})
