// VSCode と同じ Monaco エディタを Markdown 編集用に薄くラップしたコンポーネント。
//
// LAN ツール用なので CDN から monaco をフェッチさせず、bundle 同梱の monaco-editor を
// 強制利用する (loader.config({ monaco })) 。Vite の ?worker import で editor.worker
// も自動的に同梱される (markdown は専用 language worker を持たない)。
//
// 親 (ReadmeEditPage / NoteEditPage) は ref から insertAtCursor を呼んでファイル名や
// パスを Monaco の現在カーソル位置へ挿入する。

import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import type { editor as monacoEditor } from 'monaco-editor'
import { defineMonacoTheme, MONACO_THEME_NAMES, monacoFontFamily } from '@mado/design-system/monaco'
import { useDocumentTheme } from '@mado/design-system/react'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

// モジュール初回 import 時に 1 回だけ走る。冪等 (idempotent) なガード付き。
if (typeof self !== 'undefined' && !self.MonacoEnvironment) {
  self.MonacoEnvironment = { getWorker: () => new editorWorker() }
  loader.config({ monaco })
}

export interface MonacoMarkdownEditorHandle {
  insertAtCursor(text: string): void
  focus(): void
}

interface Props {
  value: string
  onChange: (next: string) => void
  height?: string | number
  ariaLabel?: string
}

export const MonacoMarkdownEditor = forwardRef<MonacoMarkdownEditorHandle, Props>(
  function MonacoMarkdownEditor({ value, onChange, height = '100%', ariaLabel }, ref) {
    useLocale()
    const editorRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null)
    const theme = useDocumentTheme()

    // テーマが変わるたびに、その時点の tokens.css の値で定義し直す (デザインシステムの配色)。
    // layout effect は Editor の (passive な) effect より先に走るので、Editor が setTheme する前に定義が済む。
    useLayoutEffect(() => {
      defineMonacoTheme(monaco.editor, theme)
    }, [theme])

    const options = useMemo<monacoEditor.IStandaloneEditorConstructionOptions>(() => ({
      ariaLabel,
      wordWrap: 'on',
      minimap: { enabled: false },
      // 書体も tokens.css (--mono) から読む。Monaco は CSS の変数を解決しない。
      fontFamily: monacoFontFamily(),
      fontSize: 13,
      lineHeight: 21,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      renderLineHighlight: 'gutter',
      padding: { top: 12, bottom: 12 },
      fontLigatures: false,
      smoothScrolling: true,
      // markdown では IntelliSense が頻発しないので suggest UI は控えめ
      quickSuggestions: false,
      // ハイライトは markdown の見た目を阻害しないように
      occurrencesHighlight: 'off',
    }), [ariaLabel])

    useImperativeHandle(ref, () => ({
      insertAtCursor(text) {
        const ed = editorRef.current
        if (!ed) return
        const sel = ed.getSelection()
        if (sel) {
          ed.executeEdits('mado.insert', [{
            range: sel,
            text,
            forceMoveMarkers: true,
          }])
        } else {
          // フォーカス外 / 選択なし時は末尾に挿入。
          const model = ed.getModel()
          if (!model) return
          const lastLine = model.getLineCount()
          const lastCol = model.getLineMaxColumn(lastLine)
          ed.executeEdits('mado.insert', [{
            range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
            text,
            forceMoveMarkers: true,
          }])
        }
        ed.focus()
      },
      focus() { editorRef.current?.focus() },
    }), [])

    return (
      <Editor
        value={value}
        onChange={v => onChange(v ?? '')}
        language="markdown"
        height={height}
        theme={MONACO_THEME_NAMES[theme]}
        onMount={ed => { editorRef.current = ed }}
        options={options}
        loading={<p className="muted">{translate('monacoMarkdownEditor.loadingEditor')}</p>}
      />
    )
  },
)
