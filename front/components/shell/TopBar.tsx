import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import {
  NavigationDrawer, UserMenu, useTheme, type NavigationLayout, type UserMenuLinkRenderer,
} from '@mado/design-system/react'
import { LanguagePicker } from '../LanguagePicker'
import { useAuth } from '../../lib/auth-context'
import { THEME_STORAGE_KEY } from '../../lib/theme'
import { useIsCompact } from '../../lib/useIsCompact'
import { NavigationLinkList } from './NavigationLinkList'
import { PRODUCT_FULL_NAME, ProductLogo } from './ProductLogo'
import { localizeMessage } from '../../i18n/localizeMessage'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

// ユーザーメニューの項目は react-router の Link で描き、ページを読み直さずに移る。
const renderUserMenuLink: UserMenuLinkRenderer = (item, { children, ...props }) => (
  <Link {...props} to={item.href}>{children}</Link>
)

/**
 * 上部バー: アプリ名、表示言語とテーマの切り替え、ログイン中の利用者のメニュー (アカウント・設定・
 * サインアウト)。画面の切り替えはサイドバーにあり、md (900px) 未満ではこのバーのメニューボタンから
 * ドロワーで開く。
 */
export function TopBar({ navigation }: { navigation: NavigationLayout }) {
  useLocale()
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const theme = useTheme({ storageKey: THEME_STORAGE_KEY })
  const compact = useIsCompact()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const themeLabel = theme.theme === 'light' ? translate('topBar.switchToDarkTheme') : translate('topBar.switchToLightTheme')
  const signOut = async () => {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : translate('common.couldNotSignOut'))
    } finally {
      setLoggingOut(false)
    }
  }
  return (
    <>
      <a className="skip-link" href="#content">{translate('topBar.skipToContent')}</a>
      <header className="topbar">
        {navigation.mode === 'drawer' && (
          <NavigationDrawer
            labels={{
              open: translate('navigationDrawer.openMenu'),
              close: translate('navigationDrawer.closeMenu'),
              navigation: translate('common.mainNavigation'),
            }}
            header={<ProductLogo />}
          >
            <NavigationLinkList />
          </NavigationDrawer>
        )}
        <Link to="/" className="brand" aria-label={translate('topBar.goToHome', { value0: PRODUCT_FULL_NAME })}><ProductLogo compact={compact} /></Link>
        <div className="topbar-actions">
          <LanguagePicker />
          <button
            type="button"
            className="icon-button"
            onClick={theme.toggle}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {theme.theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
          </button>
          {user && (
            <UserMenu
              displayName={user.displayName}
              email={user.email}
              label={translate('topBar.userMenu')}
              items={[
                { label: translate('section.account'), href: '/settings/account' },
                { label: translate('section.settings'), href: '/settings', startsGroup: true },
                { label: translate('common.signOut'), onSelect: () => void signOut(), disabled: loggingOut, startsGroup: true },
              ]}
              renderLink={renderUserMenuLink}
              closeKey={pathname}
            />
          )}
        </div>
      </header>
      {logoutError && <p className="notice error topbar-notice" role="alert">{localizeMessage(logoutError)}</p>}
    </>
  )
}
