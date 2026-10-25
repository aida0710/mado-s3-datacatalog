import { Check } from 'lucide-react'
import { useCopyFeedback } from '../lib/useCopyFeedback'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

interface Props {
  // 画面に出す短い名前 (basename)。幅が足りないので末尾を省略する。
  text: string
  // ホバーで見せ、クリックでクリップボードに載せる省略しないフルパス。
  fullPath: string
  className?: string
}

// ファイル名の見出し。デッキのトラック行とピンカードのヘッダで共有する。
//
// 表示は basename だけ (フルパスは長すぎてどちらの枠にも収まらない) だが、
// それだけだと tar 内エントリがどのアーカイブの何なのか辿れない。title で
// フルパスを見せ、クリックで丸ごとコピーできるようにして補う。
//
// 枠は付けない — 密なドックの中でファイル名がボタンの箱に見えてしまう。
// hover の下線だけを手掛かりにする (見た目は preview.css の .copyable-path)。
export function CopyablePath({ text, fullPath, className }: Props) {
  useLocale()
  const { copied, copy } = useCopyFeedback()

  return (
    <button
      type="button"
      className={className ? `copyable-path ${className}` : 'copyable-path'}
      title={fullPath}
      aria-label={translate('copyablePath.copyPath', { value0: fullPath })}
      onClick={() => void copy(fullPath)}
    >
      {copied && <Check size={14} aria-hidden="true" />}
      <span className="copyable-path-text">
        {copied == null ? text : copied ? translate('common.copied') : translate('common.copyFailed')}
      </span>
    </button>
  )
}
