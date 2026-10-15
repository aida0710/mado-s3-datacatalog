import { useState, type FormEvent } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NamespaceSelector } from './NamespaceSelector'

afterEach(() => vi.restoreAllMocks())

function namespacesResponse(namespaces = ['speech', 'podcast', 'vision']) {
  return new Response(JSON.stringify({ namespaces, sourceStatus: 'ready' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  })
}

function Selection({ initial = [], onSubmit = event => event.preventDefault() }: {
  initial?: string[]
  onSubmit?: (event: FormEvent) => void
}) {
  const [selected, setSelected] = useState(initial)
  return <form onSubmit={onSubmit}><NamespaceSelector selected={selected} onChange={setSelected} disabled={false} /></form>
}

describe('Namespaceのチェック一覧', () => {
  it('検索で絞った項目を複数選べ、検索を変えても選択を保持する', async () => {
    const user = userEvent.setup()
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(namespacesResponse())
    render(<Selection />)
    await screen.findByRole('checkbox', { name: 'speech' })
    expect(screen.getByRole('checkbox', { name: 'すべてのNamespaceを許可' })).not.toBeChecked()
    const search = screen.getByRole('searchbox', { name: 'Namespaceを検索' })
    await user.type(search, 'SPEE')
    expect(screen.queryByRole('checkbox', { name: 'podcast' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'speech' }))
    await user.clear(search)
    await user.type(search, 'pod')
    await user.click(screen.getByRole('checkbox', { name: 'podcast' }))
    const selected = screen.getByRole('group', { name: '選択済みのNamespace' })
    expect(within(selected).getByRole('button', { name: 'speechの選択を解除' })).toBeInTheDocument()
    expect(within(selected).getByRole('button', { name: 'podcastの選択を解除' })).toBeInTheDocument()
    await user.clear(search)
    expect(screen.getByRole('checkbox', { name: 'speech' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'podcast' })).toBeChecked()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('一覧にない名前を追加して選べ、検索中のEnterでフォームを送信しない', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(namespacesResponse())
    const submit = vi.fn((event: FormEvent) => event.preventDefault())
    render(<Selection onSubmit={submit} />)
    const search = screen.getByRole('searchbox', { name: 'Namespaceを検索' })
    await user.type(search, 'new-pipeline{Enter}')
    expect(submit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '「new-pipeline」を追加' }))
    expect(screen.getByRole('checkbox', { name: 'new-pipeline' })).toBeChecked()
    expect(search).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'new-pipelineの選択を解除' }))
    expect(screen.queryByRole('checkbox', { name: 'new-pipeline' })).not.toBeInTheDocument()
  })

  it('すべての許可を解除すると元の個別選択へ戻る', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(namespacesResponse())
    render(<Selection initial={['speech']} />)
    const speech = await screen.findByRole('checkbox', { name: 'speech' })
    const all = screen.getByRole('checkbox', { name: 'すべてのNamespaceを許可' })
    await user.click(all)
    expect(speech).toBeChecked()
    expect(speech).toBeDisabled()
    expect(screen.getByRole('searchbox', { name: 'Namespaceを検索' })).toBeDisabled()
    await user.click(all)
    expect(speech).toBeChecked()
    expect(speech).toBeEnabled()
    expect(screen.getByRole('checkbox', { name: 'podcast' })).not.toBeChecked()
  })

  it('一覧取得に失敗しても既存の選択を失わず、再試行できる', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(namespacesResponse())
    render(<Selection initial={['legacy-name']} />)
    await screen.findByRole('alert')
    expect(screen.getByRole('checkbox', { name: 'legacy-name' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: '再試行' }))
    await screen.findByRole('checkbox', { name: 'podcast' })
    expect(screen.getByRole('checkbox', { name: 'legacy-name' })).toBeChecked()
  })
})
