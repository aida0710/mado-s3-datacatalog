import { useState, type FormEvent } from 'react'
import { LoginHeader } from '@mado/design-system/react'
import { LanguagePicker } from '../components/LanguagePicker'
import { ProductLogo } from '../components/shell/ProductLogo'
import type { z } from 'zod'
import type { AuthConfig } from '../../api/shared/schemas/auth'
import { authClient } from '../lib/api/auth-client'
import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'

/** ログイン画面とパスワード変更画面の見出しの id。重ねて出すときの dialog の名前にも使う。 */
export const AUTH_TITLE_ID = 'auth-title'

/** ログインとパスワード変更のカードの上端。ロゴと同じ行の右に表示言語の切り替えを置く。 */
function AuthCardHeader() {
  return <LoginHeader logo={<ProductLogo />} languagePicker={<LanguagePicker />} />
}

interface Props {
  config: z.infer<typeof AuthConfig>
  /** ログイン中に session が切れて、この画面へ戻されたか。 */
  sessionExpired?: boolean
  /** サインアウトしたが、SSO 側のサインアウトができなかったか。 */
  idpLogoutIncomplete?: boolean
  /**
   * 開いていた画面を残したまま、その上に重ねて出しているか。SSO はページを開き直すので、
   * 同じタブで進むと残した画面が消える。重ねているときは SSO を新しいタブで開く。
   */
  overlay?: boolean
  onLoggedIn(): Promise<void>
}

export function LoginPage({
  config, sessionExpired = false, idpLogoutIncomplete = false, overlay = false, onLoggedIn,
}: Props) {
  useLocale()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await authClient.login(String(form.get('identifier')), String(form.get('password')))
      await onLoggedIn()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate('loginPage.couldNotSignIn'))
    } finally {
      setBusy(false)
    }
  }

  // 重ねているときの SSO は新しいタブで開く。そのタブで同じ編集画面を開くと、同じ本文を
  // 2 つのエディタで書き換えかねないので、ログインのあとはホームを開く。
  const returnTo = overlay ? '/' : `${location.pathname}${location.search}${location.hash}`
  const oidcUrl = `/api/auth/oidc/start?returnTo=${encodeURIComponent(returnTo)}`
  const oidcLabel = config.oidc.enabled ? config.oidc.label : 'SSO'

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby={AUTH_TITLE_ID}>
        <AuthCardHeader />
        <h1 id={AUTH_TITLE_ID}>{translate('loginPage.signIn')}</h1>
        {(sessionExpired || idpLogoutIncomplete || overlay) && (
          <div className="login-lead">
            {sessionExpired && <p role="status">{translate('loginPage.yourSessionHasExpiredSignInAgain')}</p>}
            {idpLogoutIncomplete && (
              <p role="status">
                {translate('loginPage.youHaveSignedOutOfMadoButCould', { value0: oidcLabel })}
              </p>
            )}
            {overlay && <p>{translate('loginPage.signInWithTheSameAccountToReturn')}</p>}
          </div>
        )}

        {config.oidc.enabled && (
          <>
            <a
              className="button primary"
              href={oidcUrl}
              target={overlay ? '_blank' : undefined}
              rel={overlay ? 'noopener' : undefined}
            >
              {translate('loginPage.continueWith', { value0: oidcLabel })}</a>
            {overlay && (
              <p className="login-note">{translate('loginPage.signInInANewTabThenReturn')}</p>
            )}
          </>
        )}
        {config.oidc.enabled && config.localEnabled && <div className="login-or"><span>{translate('loginPage.or')}</span></div>}

        {config.localEnabled && (
          <form onSubmit={login}>
            <label className="field"><span>{translate('loginPage.usernameOrEmailAddress')}</span><input name="identifier" autoComplete="username" required /></label>
            <label className="field"><span>{translate('loginPage.password')}</span><input name="password" type="password" autoComplete="current-password" required /></label>
            {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
            <button type="submit" className="button primary" disabled={busy}>{busy ? translate('loginPage.checking') : translate('loginPage.signIn')}</button>
          </form>
        )}
      </section>
    </main>
  )
}

export function ChangePasswordPage({ onChanged }: { onChanged(): Promise<void> }) {
  useLocale()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get('currentPassword') ?? '')
    const newPassword = String(form.get('newPassword') ?? '')
    const confirmation = String(form.get('confirmation') ?? '')
    if (newPassword !== confirmation) {
      setError(translate('common.theNewPasswordsDoNotMatch'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      // ログイン済み（sessionがある）なので、401はsessionが切れたことを表し、AuthGateへ
      // 知らせてログイン画面へ戻す。現在のパスワードの誤りは400なので知らせない。
      await authClient.changePassword({ currentPassword, newPassword })
      await onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate('common.couldNotChangePassword'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby={AUTH_TITLE_ID}>
        <AuthCardHeader />
        <p className="login-eyebrow">{translate('loginPage.firstSignIn')}</p>
        <h1 id={AUTH_TITLE_ID}>{translate('common.changePassword')}</h1>
        <div className="login-lead"><p>{translate('loginPage.updateYourInitialPasswordOnThisScreen')}</p></div>
        <form onSubmit={submit}>
          <label className="field"><span>{translate('common.currentPassword')}</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
          <label className="field"><span>{translate('common.newPasswordAtLeast12Characters')}</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
          <label className="field"><span>{translate('common.confirmNewPassword')}</span><input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
          {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
          <button type="submit" className="button primary" disabled={busy}>{busy ? translate('common.updating') : translate('loginPage.changeAndContinue')}</button>
        </form>
      </section>
    </main>
  )
}
