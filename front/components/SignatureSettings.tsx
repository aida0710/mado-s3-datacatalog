import { localizeMessage } from '../i18n/localizeMessage'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { useState, type FormEvent } from 'react'
import { LogOut } from 'lucide-react'
import { fetchApi } from '../lib/api/http'
import { getEditorName, setEditorName } from '../lib/editorName'
import { useAuth } from '../lib/auth-context'
import { SettingsSectionHeader } from './SettingsSectionHeader'

export function SignatureSettings() {
  useLocale()
  const auth = useAuth()
  const [displayName, setDisplayName] = useState(() => auth.user?.displayName ?? '')
  const [username, setUsername] = useState(() => auth.user?.username ?? '')
  const [signatureName, setSignatureName] = useState(() => auth.user?.signatureName ?? getEditorName())
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const commit = async () => {
    const nextDisplayName = displayName.trim()
    const nextUsername = username.trim()
    const nextSignatureName = signatureName.trim()
    if (!nextSignatureName || (auth.enabled && (!nextDisplayName || !nextUsername))) return
    setSaving(true)
    setError(null)
    try {
      if (auth.enabled) {
        const response = await fetchApi('/api/auth/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: nextDisplayName,
            username: nextUsername,
            signatureName: nextSignatureName,
          }),
        })
        const body = await response.json().catch(() => null) as { error?: string } | null
        if (!response.ok) throw new Error(body?.error ?? translate("signatureSettings.couldNotSaveAccount"))
        await auth.reload()
      } else {
        setEditorName(nextSignatureName)
      }
      setDisplayName(nextDisplayName)
      setUsername(nextUsername)
      setSignatureName(nextSignatureName)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("signatureSettings.couldNotSaveAccount"))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get('currentPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')
    if (newPassword !== confirmation) {
      setError(translate("common.theNewPasswordsDoNotMatch"))
      return
    }
    setPasswordBusy(true)
    setPasswordNotice(null)
    setError(null)
    try {
      const response = await fetchApi('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!response.ok) throw new Error(translate("common.couldNotChangePassword"))
      form.reset()
      await auth.reload()
      setPasswordNotice(translate("signatureSettings.passwordChanged"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("common.couldNotChangePassword"))
    } finally {
      setPasswordBusy(false)
    }
  }

  const logout = async () => {
    setLoggingOut(true)
    setLogoutError(null)
    try {
      await auth.logout()
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : translate("common.couldNotSignOut"))
    } finally {
      setLoggingOut(false)
    }
  }

  const canSave = !saving && signatureName.trim() !== '' && (!auth.enabled || (displayName.trim() !== '' && username.trim() !== ''))

  return (
    <section className="account-settings settings-column">
      <SettingsSectionHeader title={translate("signatureSettings.manageAccountAndSignature")} />

      <form className="account-form" onSubmit={event => { event.preventDefault(); void commit() }}>
        {auth.enabled && (
          <>
            <label className="field">
              <span>{translate("common.displayName")}</span>
              <input value={displayName} onChange={event => { setDisplayName(event.target.value); setSaved(false) }} maxLength={128} autoComplete="name" required />
            </label>
            <label className="field">
              <span>{translate("common.userIdLoginId")}</span>
              <input value={username} onChange={event => { setUsername(event.target.value); setSaved(false) }} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,63}" autoComplete="username" required />
            </label>
            {auth.user?.email && (
              <div className="field readonly-field">
                <span>{translate("common.emailAddress")}</span>
                <strong className="mono">{auth.user.email}</strong>
                <small className="muted">
                  {auth.user.authMethods?.includes('sso') ? translate("common.managedByYourSsoProviderAndCannotBe") : translate("common.thisAuthenticationIdentifierCannotBeChangedInMado")}
                </small>
              </div>
            )}
          </>
        )}
        <label className="field">
          <span>{translate("signatureSettings.signature")}</span>
          <input value={signatureName} onChange={event => { setSignatureName(event.target.value); setSaved(false) }} maxLength={128} placeholder={translate("common.exampleEditor")} autoComplete="nickname" aria-label={translate("signatureSettings.signatureName")} required />
          <small className="muted">{translate("signatureSettings.recordedInThisAccountSHistoryWhenEditing")}</small>
        </label>
        <div className="form-submit-row">
          <button type="submit" className="button primary" disabled={!canSave}>{saving ? translate("common.saving") : translate("common.save")}</button>
          {saved && <span className="form-submit-row__status" role="status">{translate("signatureSettings.saved")}</span>}
        </div>
      </form>
      {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}

      {auth.enabled && (
        <>
          {auth.user?.authMethods?.includes('local') !== false && (
            <details className="account-password">
              <summary>{translate("common.changePassword")}</summary>
              <form className="account-form" onSubmit={changePassword}>
                <label className="field"><span>{translate("common.currentPassword")}</span><input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                <label className="field"><span>{translate("common.newPasswordAtLeast12Characters")}</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
                <label className="field"><span>{translate("common.confirmNewPassword")}</span><input name="confirmation" type="password" autoComplete="new-password" minLength={12} required /></label>
                <div className="form-submit-row">
                  <button type="submit" className="button primary" disabled={passwordBusy}>{passwordBusy ? translate("signatureSettings.changing") : translate("common.change")}</button>
                  {passwordNotice && <span className="form-submit-row__status" role="status">{localizeMessage(passwordNotice)}</span>}
                </div>
              </form>
            </details>
          )}
          <div className="account-signout">
            <button type="button" className="button" onClick={() => void logout()} disabled={loggingOut}>
              <LogOut size={14} aria-hidden="true" />
              {loggingOut ? translate("signatureSettings.signingOut") : translate("common.signOut")}
            </button>
            {logoutError && <p className="notice error" role="alert">{localizeMessage(logoutError)}</p>}
          </div>
        </>
      )}
    </section>
  )
}
