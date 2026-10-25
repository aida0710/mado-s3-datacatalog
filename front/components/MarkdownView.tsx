import type { Ref } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// GFM (表・タスクリスト・取り消し線・自動リンク) を CommonMark に足す。
const REMARK_PLUGINS = [remarkGfm]
// 利用者が書いた本文から、スクリプト・イベントハンドラの属性・javascript: の URL などを取り除く
// (保存された本文を開いた人のブラウザで動かさない)。
const REHYPE_PLUGINS = [rehypeSanitize]

/**
 * Team note・README・編集履歴の Markdown。文字組みは notes.css の .markdown-body。
 * className は置き場所ごとの指定 (README の折りたたみなど)、ref は高さを測る呼び出し側のため。
 */
export function MarkdownView({ source, className, ref }: {
  source: string
  className?: string
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <div ref={ref} className={className ? `markdown-body ${className}` : 'markdown-body'}>
      <Markdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS}>{source}</Markdown>
    </div>
  )
}
