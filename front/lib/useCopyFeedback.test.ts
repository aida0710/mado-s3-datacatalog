import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '@mado/design-system/clipboard'
import { COPY_FEEDBACK_MS, useCopyFeedback } from './useCopyFeedback'

vi.mock('@mado/design-system/clipboard', () => ({ copyText: vi.fn(async () => true) }))

afterEach(() => {
  vi.useRealTimers()
})

describe('useCopyFeedback', () => {
  it('コピーの成否を 1.5 秒だけ返し、そのあと押す前の表示に戻す', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCopyFeedback())
    await act(() => result.current.copy('s3://bucket/key'))
    expect(copyText).toHaveBeenCalledWith('s3://bucket/key')
    expect(result.current.copied).toBe(true)
    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS - 1))
    expect(result.current.copied).toBe(true)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.copied).toBeNull()
  })

  it('コピーできなかったときは false を返す', async () => {
    vi.mocked(copyText).mockResolvedValueOnce(false)
    const { result } = renderHook(() => useCopyFeedback())
    await act(() => result.current.copy('value'))
    expect(result.current.copied).toBe(false)
  })
})
