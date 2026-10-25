import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../lib/api/client'
import { LineageCatalog } from './LineageCatalog'

vi.mock('../../lib/api/client', async importOriginal => {
  const mod = await importOriginal<typeof import('../../lib/api/client')>()
  return { api: { ...mod.api, lineageCatalog: vi.fn() } }
})
afterEach(() => vi.clearAllMocks())

const dataset = {
  kind: 'dataset' as const, datasetId: 'dataset-1', datasetKey: 'callhome', namespace: 'speech', name: 'raw',
  displayName: 'CALLHOME raw', aliases: [], description: 'Purchased speech', mediaType: 'audio', owner: null,
  currentVersionId: 'version-1', versionCount: 2,
}

describe('LineageCatalog', () => {
  it('行のどこを押してもデータセットを選び、一覧を閉じる', async () => {
    vi.mocked(api.lineageCatalog).mockResolvedValue({ results: [dataset], totalCount: 1, nextCursor: null })
    const onSelect = vi.fn()
    render(<LineageCatalog hasSelection={false} onSelect={onSelect} />)

    fireEvent.click(await screen.findByText('Purchased speech'))

    expect(onSelect).toHaveBeenCalledWith(dataset)
    expect(screen.getByRole('button', { name: '登録一覧・検索' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('次へは応答の nextCursor で読み、前へは前のページの cursor で読み直す', async () => {
    const page = (name: string) => ({ ...dataset, datasetId: name, name, description: name })
    vi.mocked(api.lineageCatalog)
      .mockResolvedValueOnce({ results: Array.from({ length: 20 }, (_, index) => page(`first-${index}`)), totalCount: 25, nextCursor: 'cursor-2' })
      .mockResolvedValueOnce({ results: [page('second-0')], totalCount: 25, nextCursor: null })
      .mockResolvedValueOnce({ results: [page('first-0')], totalCount: 25, nextCursor: 'cursor-2' })
    render(<LineageCatalog hasSelection={false} onSelect={vi.fn()} />)
    await screen.findByText('first-0')
    expect(screen.getByText('1–20')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    await screen.findByText('second-0')
    expect(api.lineageCatalog).toHaveBeenLastCalledWith({ q: '', limit: 20, cursor: 'cursor-2' })
    expect(screen.getByText('21–21')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '前へ' }))
    await screen.findByText('first-0')
    expect(api.lineageCatalog).toHaveBeenLastCalledWith({ q: '', limit: 20, cursor: undefined })
  })

  it('行の詳細を開くボタンは、選ばずに説明とデータ形式を行の下に出す', async () => {
    vi.mocked(api.lineageCatalog).mockResolvedValue({ results: [dataset], totalCount: 1, nextCursor: null })
    const onSelect = vi.fn()
    render(<LineageCatalog hasSelection={false} onSelect={onSelect} />)

    fireEvent.click(await screen.findByRole('button', { name: '詳細を表示' }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '詳細を閉じる' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('Purchased speech')).toHaveLength(2)
  })
})
