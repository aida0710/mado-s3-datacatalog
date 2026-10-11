import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'
import { Search, X } from 'lucide-react'

interface Props {
  q: string
  recursive: boolean
  isSearching: boolean
  onChangeQ: (next: string) => void
  onToggleRecursive: (next: boolean) => void
  onClear: () => void
}

// 一覧の上の帯 (.storage-toolbar) に置く、検索欄 + 再帰チェック + クリア。
// 帯そのものは StorageBrowser が持ち、タグの絞り込みも同じ帯に並べる。
// debounce は親 (StorageBrowser) の onChangeQ ハンドラ内で setTimeout / useRef<timer> 管理。
export function SearchBar({ q, recursive, isSearching, onChangeQ, onToggleRecursive, onClear }: Props) {
  useLocale()
  return (
    <>
      <div className="storage-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          placeholder={recursive
            ? translate("searchBar.searchThisDirectoryRecursivelyPrefixMatch")
            : translate("searchBar.searchThisDirectoryPrefixMatch")}
          value={q}
          onChange={e => onChangeQ(e.target.value)}
          aria-label={translate("searchBar.searchDirectory")}
        />
        {isSearching && (
          <button
            type="button"
            className="icon-button"
            onClick={onClear}
            aria-label={translate("searchBar.clearSearch")}
            title={translate("searchBar.clearSearch")}
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <label className="storage-toolbar-item storage-toolbar-check">
        <input
          type="checkbox"
          checked={recursive}
          onChange={e => onToggleRecursive(e.target.checked)}
        />
        {translate("searchBar.recursiveSearch")}</label>
    </>
  )
}
