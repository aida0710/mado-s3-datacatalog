import { useCallback, useState } from 'react'

interface CursorPagesState {
  /** 訪問したページを読むときに渡した cursor。1 ページ目は undefined。 */
  cursors: readonly (string | undefined)[]
  pageIndex: number
}

const FIRST_PAGE: CursorPagesState = { cursors: [undefined], pageIndex: 0 }

/**
 * API の一覧は次のページの cursor (nextCursor) しか返さないので、前のページへ戻れるよう
 * 訪問したページの cursor を覚えておく。
 */
export function useCursorPages() {
  const [state, setState] = useState<CursorPagesState>(FIRST_PAGE)
  /** 今のページの応答が返した nextCursor で次のページへ進む。 */
  const goNext = useCallback((nextCursor: string) => {
    setState(current => ({
      cursors: [...current.cursors.slice(0, current.pageIndex + 1), nextCursor],
      pageIndex: current.pageIndex + 1,
    }))
  }, [])
  const goPrevious = useCallback(() => {
    setState(current => ({ ...current, pageIndex: Math.max(0, current.pageIndex - 1) }))
  }, [])
  /** 検索の条件が変わったときなど、1 ページ目から読み直す。 */
  const reset = useCallback(() => setState(FIRST_PAGE), [])
  return { cursor: state.cursors[state.pageIndex], pageIndex: state.pageIndex, goNext, goPrevious, reset }
}
