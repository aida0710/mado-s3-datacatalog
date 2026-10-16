import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthContext } from '../lib/auth-context'
import { AUTH_FIXTURE } from '../lib/auth-fixture'
import { EditorShell } from './EditorShell'

// Monaco を出さず、テスト用の小さな textarea で body を編集できるようにする。
// EditorShell は children render-prop で body/setBody を受け取る設計なので、
// テストでは textarea を差し込むだけで dirty 管理や save フローを検証できる。
// useBlocker は data router (createMemoryRouter + RouterProvider) を要求するので
// MemoryRouter ではなく createMemoryRouter で wrap する。
function shellWith(props: {
  initialBody?: string
  onSave?: (body: string) => Promise<void>
  onSaved?: () => void
  onCancel?: () => void
  leftPane?: ReactNode
}) {
  const {
    initialBody = '',
    onSave = async () => {},
    onSaved = () => {},
    onCancel = () => {},
    leftPane,
  } = props

  const router = createMemoryRouter([
    {
      path: '*',
      element: (
        <EditorShell
          title="Edit"
          initialBody={initialBody}
          onSave={onSave}
          onSaved={onSaved}
          onCancel={onCancel}
          leftPane={leftPane}
        >
          {({ body, setBody }) => (
            <textarea
              aria-label="Markdown body"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          )}
        </EditorShell>
      ),
    },
  ])
  return <AuthContext.Provider value={AUTH_FIXTURE}><RouterProvider router={router} /></AuthContext.Provider>
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.restoreAllMocks()
})

describe('EditorShell — saving', () => {
  it('保存すると本文をonSaveに渡してonSavedを呼ぶ', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onSaved = vi.fn()
    const user = userEvent.setup()

    render(shellWith({ initialBody: 'hello', onSave, onSaved }))

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onSave).toHaveBeenCalledWith('hello')
    expect(onSaved).toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('保存に失敗したら onSaved を呼ばず、理由を出す', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    const onSaved = vi.fn()
    const user = userEvent.setup()
    render(shellWith({ initialBody: 'hello', onSave, onSaved }))

    await user.click(screen.getByRole('button', { name: '保存' }))
    expect(onSaved).not.toHaveBeenCalled()
    expect(await screen.findByText(/boom/)).toBeTruthy()
  })

  it('アカウントの署名名が編集不可で表示される', () => {
    render(shellWith({ initialBody: '' }))
    expect(screen.getByLabelText('編集者名')).toHaveValue('tanaka')
    expect(screen.getByLabelText('編集者名')).toHaveAttribute('readonly')
  })
})

describe('EditorShell — 離脱の警告', () => {
  it('何も変えていなければ確認なしでキャンセルできる', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(shellWith({ initialBody: 'hello', onCancel }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    // dirty=false なので confirm は呼ばれない
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('本文を変えた後のキャンセルは確認し、断ればキャンセルしない', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(shellWith({ initialBody: 'hello', onCancel }))
    // body を編集 → dirty
    const ta = screen.getByLabelText('Markdown body')
    await user.click(ta)
    await user.type(ta, ' world')

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('本文を変えた後でも確認に応じればキャンセルする', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(shellWith({ initialBody: 'hello', onCancel }))
    const ta = screen.getByLabelText('Markdown body')
    await user.click(ta)
    await user.type(ta, '!')

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('本文を変えている間だけ beforeunload を登録し、戻せば外す', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const user = userEvent.setup()

    render(shellWith({ initialBody: 'hello' }))
    // 初期は dirty=false → beforeunload は登録されていない
    expect(
      addSpy.mock.calls.some(([type]) => type === 'beforeunload'),
    ).toBe(false)

    // 編集 → dirty=true → 登録される
    const ta = screen.getByLabelText('Markdown body')
    await user.click(ta)
    await user.type(ta, 'x')
    expect(
      addSpy.mock.calls.some(([type]) => type === 'beforeunload'),
    ).toBe(true)

    // 入力を元に戻す → dirty=false → 登録解除される
    await user.clear(ta)
    await user.type(ta, 'hello')
    expect(
      removeSpy.mock.calls.some(([type]) => type === 'beforeunload'),
    ).toBe(true)
  })
})

describe('EditorShell — layout', () => {
  it('leftPane が無ければ 1 ペインで描く', () => {
    const { container } = render(shellWith({ initialBody: '' }))
    const section = container.querySelector('.editpage')!
    expect(section.classList.contains('editpage--two-pane')).toBe(false)
    expect(container.querySelector('.editpage__sidebar')).toBeNull()
  })

  it('leftPane があれば 2 ペインで描く', () => {
    const { container } = render(
      shellWith({
        initialBody: '',
        leftPane: <div data-testid="left-pane">sidebar</div>,
      }),
    )
    const section = container.querySelector('.editpage')!
    expect(section.classList.contains('editpage--two-pane')).toBe(true)
    expect(screen.getByTestId('left-pane')).toBeInTheDocument()
  })

  it('leftPane が無ければサイドバーの開閉ボタンを出さない', () => {
    render(shellWith({ initialBody: '' }))
    expect(screen.queryByRole('button', { name: /ファイル参照/ })).toBeNull()
  })

  it('開閉ボタンを押すとサイドバーの mobile-open 属性が切り替わる', async () => {
    const user = userEvent.setup()
    const { container } = render(
      shellWith({
        initialBody: '',
        leftPane: <div data-testid="left-pane">sidebar</div>,
      }),
    )

    const sidebar = container.querySelector('.editpage__sidebar')!
    // 初期: 閉じている (= data-mobile-open="false")。デスクトップでは CSS により
    // 常時表示されるが、この属性自体はモバイル時の表示判定に使う。
    expect(sidebar.getAttribute('data-mobile-open')).toBe('false')

    const toggle = screen.getByRole('button', { name: /ファイル参照/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    await user.click(toggle)
    expect(sidebar.getAttribute('data-mobile-open')).toBe('true')
    expect(screen.getByRole('button', { name: /閉じる/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /閉じる/ }).getAttribute('aria-expanded'),
    ).toBe('true')

    // もう一度押すと閉じる
    await user.click(screen.getByRole('button', { name: /閉じる/ }))
    expect(sidebar.getAttribute('data-mobile-open')).toBe('false')
  })
})
