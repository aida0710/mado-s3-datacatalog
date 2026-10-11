import { translate } from '../../i18n/translate'
import { HardDrive, House, Network, Settings, type LucideIcon } from 'lucide-react'

export interface NavigationLink {
  to: string
  label: string
  icon: LucideIcon
}

/** 左のサイドバー (狭い画面ではドロワー) に並べる画面。 */
export const NAVIGATION_LINKS: readonly NavigationLink[] = [
  { to: '/', get label() { return translate('navigation.home') }, icon: House },
  { to: '/storage', get label() { return translate('common.storage') }, icon: HardDrive },
  { to: '/lineage', get label() { return translate('common.dataLineage') }, icon: Network },
  { to: '/settings', get label() { return translate('common.settings') }, icon: Settings },
]

/** 今の画面がこのリンクの配下か。Home は / のときだけ。 */
export function isCurrentLink(to: string, pathname: string): boolean {
  if (to === '/') return pathname === '/' || pathname === '/edit-note'
  return pathname === to || pathname.startsWith(`${to}/`)
}
