import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Moon, Sun } from 'lucide-react'
import { initialsOf } from '@mado/design-system/format'
import { NavigationDrawer, useTheme, type NavigationLayout } from '@mado/design-system/react'
import { LanguagePicker } from '../LanguagePicker'
import { useAuth } from '../../lib/auth-context'
import { THEME_STORAGE_KEY } from '../../lib/theme'
import { useIsCompact } from '../../lib/useIsCompact'
import { NavigationLinkList } from './NavigationLinkList'
import { PRODUCT_FULL_NAME, ProductLogo } from './ProductLogo'
import { localizeMessage } from '../../i18n/localizeMessage'
import { useLocale } from '../../i18n/useLocale'
import { translate } from '../../i18n/translate'

/**
 * 上部バー: アプリ名、テーマの切り替え、ログイン中の利用者とサインアウト。画面の切り替えは
 * サイドバーにあり、md (900px) 未満ではこのバーのメニューボタンからドロワーで開く。
 */
export function TopBar({ navigation }: { navigation: NavigationLayout }) {
  useLocale()
  const { user, logout } = useAuth()
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
            <>
              <Link
                to="/settings/account"
                className="avatar"
                aria-label={translate('topBar.sAccount', { value0: user.displayName })}
                title={user.displayName}
              >
                {initialsOf(user.displayName)}
              </Link>
              <button
                type="button"
                className="icon-button"
                aria-label={translate('common.signOut')}
                title={translate('common.signOut')}
                disabled={loggingOut}
                onClick={() => void signOut()}
              >
                <LogOut size={17} />
              </button>
            </>
          )}
        </div>
      </header>
      {logoutError && <p className="notice error topbar-notice" role="alert">{localizeMessage(logoutError)}</p>}
    </>
  )
}
