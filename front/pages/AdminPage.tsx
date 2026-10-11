import { localizeMessage } from '../i18n/localizeMessage'
import { getIntlLocale } from '../i18n/locale'
import { useLocale } from '../i18n/useLocale'
import { translate } from '../i18n/translate'
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { ChevronDown, ChevronUp, Copy, RefreshCw } from 'lucide-react'
import { DeleteConfirmDialog } from '../components/DeleteConfirmDialog'
import { fetchApi } from '../lib/api/http'
import { useAuth } from '../lib/auth-context'
import { narrowerThan } from '../lib/breakpoints'
import { useMediaQuery } from '../lib/useMediaQuery'

interface UserRow {
  id: string
  username: string | null
  email: string | null
  displayName: string
  status: 'active' | 'disabled'
  roles: string[]
  authMethods: Array<'local' | 'sso'>
}

interface ServiceAccountRow {
  id: string
  name: string
  description: string
  status: 'active' | 'disabled'
}

interface AuditEventRow {
  id: number
  occurred_at: string
  actor_type: string
  actor_label: string
  action: string
  resource_type: string | null
  resource_id: string | null
  outcome: 'pending' | 'success' | 'denied' | 'failure'
  details?: {
    target?: { displayName?: string | null; username?: string | null }
    changes?: Array<{ field: string; label?: string; before: unknown; after: unknown }>
    [key: string]: unknown
  }
}

interface AuditPage {
  events: AuditEventRow[]
  nextBeforeId: number | null
}

const ACTION_LABELS: Record<string, string> = {
  get 'auth.password.change'() { return translate("adminPage.changePassword") },
  get 'auth.profile.update'() { return translate("adminPage.updateAccountSettings") },
  get 'auth.bootstrap_admin'() { return translate("adminPage.createInitialAdministrator") },
  get 'auth.oidc.session_revoke'() { return translate("adminPage.revokeSsoSession") },
  get 'auth.oidc.sync'() { return translate("adminPage.syncSsoAccountInformation") },
  get 'connection.create'() { return translate("common.addConnection") },
  get 'connection.update'() { return translate("adminPage.updateConnection") },
  get 'connection.delete'() { return translate("common.deleteConnection") },
  get 'connection.default.set'() { return translate("adminPage.changeDefaultConnection") },
  get 'note.update'() { return translate("adminPage.saveSharedNote") },
  get 'note.read'() { return translate("adminPage.viewSharedNote") },
  get 'storage.readme.update'() { return translate("adminPage.saveReadme") },
  get 'storage.readme.read'() { return translate("adminPage.viewReadme") },
  get 'storage.scan.start'() { return translate("adminPage.startScan") },
  get 'storage.tag.assign'() { return translate("adminPage.assignTag") },
  get 'storage.tag.remove'() { return translate("adminPage.removeTag") },
  get 'storage.favorite.add'() { return translate("adminPage.addToFavorites") },
  get 'storage.favorite.remove'() { return translate("adminPage.removeFromFavorites") },
  get 'storage.download.raw'() { return translate("adminPage.downloadFile") },
  get 'storage.download.tar'() { return translate("adminPage.downloadArchive") },
  get 'storage.download.tar-entry'() { return translate("adminPage.downloadArchiveEntry") },
  get 'storage.preview.text'() { return translate("adminPage.viewText") },
  get 'storage.preview.image'() { return translate("adminPage.viewImage") },
  get 'tag.create'() { return translate("adminPage.createTag") },
  get 'tag.update'() { return translate("adminPage.updateTag") },
  get 'tag.delete'() { return translate("common.deleteTag") },
  get 'setting.update'() { return translate("adminPage.updateSettings") },
  get 'pricing.refresh'() { return translate("adminPage.updatePricing") },
  get 'job.cancel'() { return translate("adminPage.abortJob") },
  get 'lineage.read'() { return translate("adminPage.viewDataLineage") },
  get 'lineage.dataset.update'() { return translate("adminPage.updateDatasetInformation") },
  get 'lineage.dataset.register'() { return translate("adminPage.registerDataset") },
  get 'lineage.location.register'() { return translate("adminPage.registerStorageLocation") },
  get 'lineage.run.register'() { return translate("common.registerProcessingHistory") },
  get 'lineage.ingest'() { return translate("adminPage.applyOpenLineageEvent") },
  get 'service_account.create'() { return translate("adminPage.createServiceAccount") },
  get 'service_account.update'() { return translate("adminPage.updateServiceAccount") },
  get 'service_account.key.issue'() { return translate("adminPage.issueApiKey") },
  get 'service_account.key.revoke'() { return translate("adminPage.revokeApiKey") },
  get 'user.create'() { return translate("adminPage.createUser") },
  get 'user.update'() { return translate("adminPage.updateUser") },
  get 'user.roles.update'() { return translate("adminPage.updateUserPermissions") },
  get 'user.password.reset'() { return translate("adminPage.resetPassword") },
  get 'user.delete'() { return translate("adminPage.deleteUser") },
  get 'user.manage'() { return translate("adminPage.userOperations") },
  get 'service_account.manage'() { return translate("adminPage.serviceAccountOperations") },
}

const OUTCOME_LABELS: Record<AuditEventRow['outcome'], string> = {
  pending: 'PENDING',
  success: 'OK',
  denied: 'DENIED',
  failure: 'ERROR',
}

const ROLE_OPTIONS = [
  { id: 'viewer', get label() { return translate("adminPage.viewerReadOnly") }, get help() { return translate("adminPage.canBrowseStorageAndDataLineage") } },
  { id: 'curator', get label() { return translate("adminPage.curatorEditContent") }, get help() { return translate("adminPage.canBrowseAndEditReadmesNotesAndTags") } },
  { id: 'operator', get label() { return translate("adminPage.operatorRunJobs") }, get help() { return translate("adminPage.canBrowseRunScansUpdatePricingAndAbort") } },
  { id: 'admin', get label() { return translate("adminPage.adminFullAdministration") }, get help() { return translate("adminPage.canManageEverythingIncludingConnectionsSettingsUsersApi") } },
] as const

type RoleId = (typeof ROLE_OPTIONS)[number]['id']

// Service Account keyの用途。Madoのデータへは読み取りのscopeだけを開く。
const KEY_SCOPE_OPTIONS = [
  { scope: 'lineage:write', get label() { return translate("adminPage.sendOpenLineageLineageWrite") }, get help() { return translate("adminPage.canWriteLineageOnlyToAllowedNamespaces") } },
  { scope: 'metrics:read', get label() { return translate("adminPage.prometheusCollectionMetricsRead") }, get help() { return translate("adminPage.canReadBucketNamesAndCapacitiesForEvery") } },
] as const

type KeyScope = (typeof KEY_SCOPE_OPTIONS)[number]['scope']

interface UsersResponse {
  users: UserRow[]
  ssoRoleMapping?: Record<string, string>
}

function normalizeSsoRoleMapping(mapping: Record<string, string> | undefined) {
  const roleOrder = new Map(ROLE_OPTIONS.map((option, index) => [option.id, index]))
  return Object.entries(mapping ?? {})
    .filter((entry): entry is [string, RoleId] => roleOrder.has(entry[1] as RoleId))
    .map(([group, role]) => ({ group, role }))
    .sort((a, b) => (roleOrder.get(a.role) ?? 0) - (roleOrder.get(b.role) ?? 0)
      || a.group.localeCompare(b.group))
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.map(formatAuditValue).join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetchApi(url, init)
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? response.statusText)
  }
  return response.json() as Promise<T>
}

const OUTCOME_BADGES: Record<AuditEventRow['outcome'], string> = {
  pending: 'status-attention',
  success: 'status-finished',
  denied: 'status-failed',
  failure: 'status-failed',
}

const STATUS_BADGES: Record<'active' | 'disabled', string> = {
  active: 'status-finished',
  disabled: 'status-queued',
}

// 行のクリックで詳細を開く。行の中のボタンや入力欄は、それぞれの操作だけをする。
const INTERACTIVE_SELECTOR = 'a, button, input, select, textarea, label, summary'

function isFromControl(event: MouseEvent<HTMLElement>) {
  const control = (event.target as Element).closest(INTERACTIVE_SELECTOR)
  return control !== null && event.currentTarget.contains(control)
}

/** 開いている行の key の集合と、その開け閉め。 */
function useOpenRows<K>() {
  useLocale()
  const [open, setOpen] = useState<ReadonlySet<K>>(() => new Set())
  const toggle = useCallback((key: K) => setOpen(current => {
    const next = new Set(current)
    if (!next.delete(key)) next.add(key)
    return next
  }), [])
  return [open, toggle] as const
}

/** 表の右端の、行の下に詳細を開くボタン。 */
function RowToggle({ open, controls, onToggle }: { open: boolean; controls: string; onToggle: () => void }) {
  useLocale()
  const label = open ? translate("common.hideDetails") : translate("common.showDetails")
  return (
    <button
      type="button"
      className="icon-button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
    </button>
  )
}

/** 一度だけ表示する秘密の値 (一時パスワード・API key)。閉じたら二度と出ない。 */
function SecretNotice({ secret, note, onClose }: {
  secret: { label: string; value: string }
  note: string
  onClose: () => void
}) {
  useLocale()
  const ref = useRef<HTMLDivElement>(null)
  // 一覧の下の行やフォームから発行すると、ここは画面の外にあることが多い。見えるところまで送る。
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [secret.value])
  return (
    <div ref={ref} className="secret-notice" role="status">
      <strong>{secret.label} — {note}</strong>
      <code>{secret.value}</code>
      <span className="secret-notice__actions">
        <button type="button" className="button small" onClick={() => void navigator.clipboard.writeText(secret.value)}>
          <Copy size={14} aria-hidden="true" />
          {translate("adminPage.copy")}</button>
        <button type="button" className="button small" onClick={onClose}>{translate("common.close")}</button>
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: 'active' | 'disabled' }) {
  useLocale()
  return <span className={`status-badge ${STATUS_BADGES[status]}`}>{status}</span>
}

function UsersPage() {
  useLocale()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [ssoRoleMappings, setSsoRoleMappings] = useState<Array<{ group: string; role: RoleId }>>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<RoleId>('viewer')
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null)
  const [deleting, setDeleting] = useState<UserRow | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'' | UserRow['status']>('')
  const [openIds, toggleRow] = useOpenRows<string>()
  // 狭い画面ではメール・権限・認証の列を省く。どれも行を開いた編集欄に出ている。
  const isNarrow = useMediaQuery(narrowerThan('md'))

  const reload = useCallback(async () => {
    setError(null)
    try {
      const body = await jsonRequest<UsersResponse>('/api/internal/users')
      setUsers(body.users)
      setSsoRoleMappings(normalizeSsoRoleMapping(body.ssoRoleMapping))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("common.couldNotLoadUsers"))
    }
  }, [])

  useEffect(() => {
    let current = true
    jsonRequest<UsersResponse>('/api/internal/users')
      .then(body => {
        if (!current) return
        setUsers(body.users)
        setSsoRoleMappings(normalizeSsoRoleMapping(body.ssoRoleMapping))
      })
      .catch(cause => {
        if (current) setError(cause instanceof Error ? cause.message : translate("common.couldNotLoadUsers"))
      })
    return () => { current = false }
  }, [])

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setError(null)
    try {
      await jsonRequest('/api/internal/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.get('username'), email: form.get('email') || null,
          displayName: form.get('displayName'), password: form.get('password'), roles: [form.get('role')],
        }),
      })
      formElement.reset()
      setRole('viewer')
      setNotice(translate("adminPage.localUserCreatedAPasswordChangeIsRequired"))
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotCreate"))
    }
  }

  const updateUser = async (event: FormEvent<HTMLFormElement>, user: UserRow) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setNotice(null)
    try {
      await jsonRequest(`/api/internal/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.get('displayName'),
          username: form.get('username'),
          status: form.get('status'),
        }),
      })
      // SSO連携済みUserのRoleはAuthentikを正本としてlogin時に同期する。
      // disabledなform controlはFormDataに含まれないため、API呼び出し自体も明示的に省く。
      if (!user.authMethods.includes('sso')) {
        const nextRole = String(form.get('role'))
        if (user.roles.length !== 1 || user.roles[0] !== nextRole) {
          await jsonRequest(`/api/internal/users/${encodeURIComponent(user.id)}/roles`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles: [nextRole] }),
          })
        }
      }
      setNotice(translate("adminPage.updated", { value0: String(form.get('displayName')) }))
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotUpdate"))
    }
  }

  const resetPassword = async (user: UserRow) => {
    setError(null)
    setNotice(null)
    try {
      const body = await jsonRequest<{ temporaryPassword: string }>(`/api/internal/users/${encodeURIComponent(user.id)}/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      setSecret({ label: translate("adminPage.temporaryPasswordFor", { value0: user.displayName }), value: body.temporaryPassword })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotResetPassword"))
    }
  }

  // 失敗したときは確認のダイアログに理由を出し、閉じずに残す。
  const deleteUser = async (user: UserRow) => {
    setError(null)
    setNotice(null)
    await jsonRequest(`/api/internal/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
    setDeleting(null)
    setNotice(translate("adminPage.deleted", { value0: user.displayName }))
    await reload()
  }

  const needle = query.trim().toLowerCase()
  const visibleUsers = users.filter(user =>
    (!statusFilter || user.status === statusFilter)
    && (!needle || [user.displayName, user.username, user.email]
      .some(value => value?.toLowerCase().includes(needle))))
  const columnCount = isNarrow ? 3 : 6

  return (
    <section className="admin-users">
      {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
      {notice && <p className="notice success" role="status">{localizeMessage(notice)}</p>}
      {secret && <SecretNotice secret={secret} note={translate("adminPage.shownOnlyOnce")} onClose={() => setSecret(null)} />}
      {users.length > 0 && (
        <>
          <div className="admin-toolbar" role="search">
            <input
              type="search"
              aria-label={translate("adminPage.searchUsers")}
              placeholder={translate("adminPage.displayNameUserIdOrEmailAddress")}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <select
              aria-label={translate("adminPage.filterByStatus")}
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as '' | UserRow['status'])}
            >
              <option value="">{translate("adminPage.allStatuses")}</option>
              <option value="active">{translate("adminPage.active")}</option>
              <option value="disabled">{translate("adminPage.disabled")}</option>
            </select>
          </div>
          {visibleUsers.length === 0 ? (
            <p className="state-message">{translate("adminPage.noUsersMatchTheseConditions")}</p>
          ) : (
            <div className="table-scroll">
              <table className="responsive-table admin-users-table">
                <thead>
                  <tr>
                    <th scope="col">{translate("common.displayName")}</th>
                    {!isNarrow && <th scope="col">{translate("common.emailAddress")}</th>}
                    {!isNarrow && <th scope="col">{translate("adminPage.permissions")}</th>}
                    {!isNarrow && <th scope="col">{translate("adminPage.authentication")}</th>}
                    <th scope="col">{translate("common.status")}</th>
                    <th scope="col" className="responsive-table-toggle"><span className="sr-only">{translate("common.showDetails")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map(user => {
                    const isOpen = openIds.has(user.id)
                    const detailId = `admin-user-${user.id}`
                    const sso = user.authMethods.includes('sso')
                    return [
                      <tr
                        key={user.id}
                        className={isOpen ? 'clickable-row selected' : 'clickable-row'}
                        onClick={event => { if (!isFromControl(event)) toggleRow(user.id) }}
                      >
                        <td>
                          <span className="user-name">
                            <strong>{user.displayName}</strong>
                            <span className="muted mono">{user.username ?? translate("adminPage.userIdNotSet")}</span>
                          </span>
                        </td>
                        {!isNarrow && <td className="break-word">{user.email ?? '—'}</td>}
                        {!isNarrow && <td>{user.roles.join(', ') || '—'}</td>}
                        {!isNarrow && <td>{user.authMethods.join(' + ') || translate("common.notSet")}</td>}
                        <td><StatusBadge status={user.status} /></td>
                        <td className="responsive-table-toggle">
                          <RowToggle open={isOpen} controls={detailId} onToggle={() => toggleRow(user.id)} />
                        </td>
                      </tr>,
                      isOpen && (
                        <tr key={`${user.id}-details`} id={detailId} className="responsive-table-details">
                          <td colSpan={columnCount}>
                            <form
                              className="admin-user-form"
                              aria-label={translate("adminPage.edit", { value0: user.displayName })}
                              onSubmit={event => void updateUser(event, user)}
                            >
                              <label className="field">
                                <span>{translate("common.displayName")}</span>
                                <input name="displayName" defaultValue={user.displayName} maxLength={128} required />
                              </label>
                              <label className="field">
                                <span>{translate("common.userIdLoginId")}</span>
                                <input name="username" defaultValue={user.username ?? ''} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,63}" required />
                              </label>
                              {user.email && (
                                <div className="field readonly-field admin-user-form__wide">
                                  <span>{translate("common.emailAddress")}</span>
                                  <strong className="mono">{user.email}</strong>
                                  <small className="muted">
                                    {sso ? translate("adminPage.managedByTheSsoProviderAndCannotBe") : translate("common.thisAuthenticationIdentifierCannotBeChangedInMado")}
                                  </small>
                                </div>
                              )}
                              <label className="field">
                                <span>{translate("adminPage.permissions")}</span>
                                <select
                                  name="role"
                                  defaultValue={user.roles[0] ?? 'viewer'}
                                  disabled={sso}
                                  aria-describedby={sso ? `sso-role-help-${user.id}` : undefined}
                                >
                                  {ROLE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                                </select>
                                {sso && (
                                  <small id={`sso-role-help-${user.id}`} className="muted">
                                    {translate("common.managedByYourSsoProviderAndCannotBe")}</small>
                                )}
                              </label>
                              <label className="field">
                                <span>{translate("common.status")}</span>
                                <select name="status" defaultValue={user.status}>
                                  <option value="active">{translate("adminPage.active")}</option>
                                  <option value="disabled">{translate("adminPage.disabled")}</option>
                                </select>
                              </label>
                              <dl className="admin-user-meta admin-user-form__wide">
                                <div><dt>{translate("adminPage.internalId")}</dt><dd className="mono">{user.id}</dd></div>
                                <div><dt>{translate("adminPage.authentication")}</dt><dd>{user.authMethods.join(' + ') || translate("common.notSet")}</dd></div>
                              </dl>
                              <div className="admin-user-form__actions admin-user-form__wide">
                                <button type="submit" className="button primary">{translate("common.save")}</button>
                                {!(sso && !user.authMethods.includes('local')) && (
                                  <button type="button" className="button" onClick={() => void resetPassword(user)}>{translate("adminPage.resetPassword")}</button>
                                )}
                                {user.id !== currentUser?.id && (
                                  <button type="button" className="button danger" onClick={() => setDeleting(user)}>{translate("common.delete")}</button>
                                )}
                              </div>
                            </form>
                          </td>
                        </tr>
                      ),
                    ]
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <section className="admin-section">
        <form className="admin-create-form" onSubmit={createUser} aria-labelledby="admin-create-user-title">
          <div className="section-heading"><h2 id="admin-create-user-title">{translate("adminPage.addUser")}</h2></div>
          <div className="admin-form-grid">
            <label className="field"><span>{translate("common.displayName")}</span><input name="displayName" placeholder={translate("adminPage.eGMadoCurator")} required /></label>
            <label className="field"><span>{translate("common.userIdLoginId")}</span><input name="username" placeholder={translate("adminPage.eGCurator")} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,63}" required /></label>
            <label className="field"><span>{translate("adminPage.emailAddressOptional")}</span><input name="email" type="email" placeholder="email@example.jp" /></label>
            <label className="field"><span>{translate("adminPage.initialPasswordAtLeast12Characters")}</span><input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
            <label className="field admin-form-grid__wide">
              <span>{translate("adminPage.permissions")}</span>
              <select name="role" value={role} onChange={event => setRole(event.target.value as RoleId)}>
                {ROLE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <small className="muted">{ROLE_OPTIONS.find(option => option.id === role)?.help}</small>
            </label>
          </div>
          <button type="submit" className="button primary">{translate("common.create")}</button>
        </form>
        <blockquote className="sso-guidance">
          <p>{translate("adminPage.forSsoTheFollowingAuthentikGroupsMapTo")}</p>
          <ul>
            {ssoRoleMappings.map(({ group, role }) => (
              <li key={group}>
                <code>{group}</code>
                <span aria-hidden="true">→</span>
                <strong>{ROLE_OPTIONS.find(option => option.id === role)?.label}</strong>
              </li>
            ))}
            {ssoRoleMappings.length === 0 && <li className="sso-guidance__empty">{translate("adminPage.noSsoPermissionMappingsAreConfigured")}</li>}
          </ul>
        </blockquote>
      </section>

      {deleting && (
        <DeleteConfirmDialog
          titleId="admin-user-delete-title"
          title={translate("adminPage.deleteUser")}
          onConfirm={() => deleteUser(deleting)}
          onCancel={() => setDeleting(null)}
        >
          {translate("adminPage.confirmUserDeletion", { value0: deleting.displayName })}
        </DeleteConfirmDialog>
      )}
    </section>
  )
}

function ServiceAccountsPage() {
  useLocale()
  const [accounts, setAccounts] = useState<ServiceAccountRow[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [keyScope, setKeyScope] = useState<KeyScope>('lineage:write')

  const reload = useCallback(async () => {
    setError(null)
    try {
      const body = await jsonRequest<{ accounts: ServiceAccountRow[] }>('/api/internal/service-accounts')
      setAccounts(body.accounts)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotLoadServiceAccounts"))
    }
  }, [])

  useEffect(() => {
    let current = true
    jsonRequest<{ accounts: ServiceAccountRow[] }>('/api/internal/service-accounts')
      .then(body => { if (current) setAccounts(body.accounts) })
      .catch(cause => {
        if (current) setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotLoadServiceAccounts"))
      })
    return () => { current = false }
  }, [])

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setError(null)
    try {
      await jsonRequest('/api/internal/service-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), description: form.get('description') }),
      })
      formElement.reset()
      setNotice(translate("adminPage.serviceAccountCreated"))
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotCreate"))
    }
  }

  const issueKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const accountId = String(form.get('accountId') ?? '')
    // namespaceはOpenLineageの書き込み先を絞るもので、読み取り用keyには送らない。
    const namespaces = keyScope === 'lineage:write'
      ? String(form.get('namespaces') ?? '').split(',').map(value => value.trim()).filter(Boolean)
      : []
    setError(null)
    try {
      const body = await jsonRequest<{ key: { name: string; token: string } }>(
        `/api/internal/service-accounts/${encodeURIComponent(accountId)}/keys`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.get('name'), scopes: [keyScope], namespaces }),
        },
      )
      setSecret({ label: body.key.name, value: body.key.token })
      formElement.reset()
      setNotice(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotIssueKey"))
    }
  }

  return (
    <section className="admin-accounts">
      {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
      {notice && <p className="notice success" role="status">{localizeMessage(notice)}</p>}
      {secret && <SecretNotice secret={secret} note={translate("adminPage.thisKeyIsShownOnlyOnce")} onClose={() => setSecret(null)} />}
      {accounts.length > 0 && (
        <div className="table-scroll">
          <table className="admin-accounts-table">
            <thead>
              <tr>
                <th scope="col">{translate("common.name")}</th>
                <th scope="col">{translate("adminPage.purpose")}</th>
                <th scope="col">{translate("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => (
                <tr key={account.id}>
                  <td className="break-word"><strong>{account.name}</strong></td>
                  <td className={account.description ? undefined : 'muted'}>{account.description || translate("adminPage.noDescription")}</td>
                  <td><StatusBadge status={account.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="admin-forms">
        <section className="admin-section">
          <form onSubmit={createAccount} aria-labelledby="admin-create-account-title">
            <div className="section-heading"><h2 id="admin-create-account-title">{translate("adminPage.addServiceAccount")}</h2></div>
            <label className="field"><span>{translate("adminPage.serviceAccountName")}</span><input name="name" placeholder={translate("adminPage.eGNemoCuratorProduction")} required /></label>
            <label className="field"><span>{translate("adminPage.purposeOptional")}</span><input name="description" placeholder={translate("adminPage.eGProductionAudioPreprocessingPipeline")} /></label>
            <button type="submit" className="button primary">{translate("common.create")}</button>
          </form>
        </section>
        <section className="admin-section">
          <form onSubmit={issueKey} aria-labelledby="admin-issue-key-title">
            <div className="section-heading"><h2 id="admin-issue-key-title">{translate("adminPage.issueApiKey2")}</h2></div>
            <label className="field">
              <span>{translate("adminPage.serviceAccount")}</span>
              <select name="accountId" required defaultValue="">
                <option value="" disabled>{translate("adminPage.selectAnOption")}</option>
                {accounts.filter(a => a.status === 'active').map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{translate("adminPage.purpose")}</span>
              <select name="scope" value={keyScope} onChange={event => setKeyScope(event.target.value as KeyScope)}>
                {KEY_SCOPE_OPTIONS.map(option => <option key={option.scope} value={option.scope}>{option.label}</option>)}
              </select>
              <small className="muted">{KEY_SCOPE_OPTIONS.find(option => option.scope === keyScope)?.help}</small>
            </label>
            <label className="field"><span>{translate("adminPage.keyName")}</span><input name="name" placeholder={translate("adminPage.eGProduction202608")} required /></label>
            {keyScope === 'lineage:write' && (
              <label className="field"><span>{translate("adminPage.allowedNamespaces")}</span><input name="namespaces" placeholder={translate("adminPage.speechPodcastCommaSeparated")} required /></label>
            )}
            <button type="submit" className="button primary">{translate("adminPage.showKeyOnce")}</button>
          </form>
        </section>
      </div>
    </section>
  )
}

function AuditTarget({ event }: { event: AuditEventRow }) {
  useLocale()
  return <>{event.details?.target?.displayName ?? event.resource_id ?? event.resource_type ?? '—'}</>
}

function AuditPageView() {
  useLocale()
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([])
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openIds, toggleRow] = useOpenRows<number>()
  // 狭い画面では時刻・操作・結果だけを行に残し、操作者と対象は開いた詳細に出す。
  const isNarrow = useMediaQuery(narrowerThan('md'))

  const reload = useCallback(async () => {
    setError(null)
    try {
      const body = await jsonRequest<AuditPage>('/api/internal/audit-events?limit=30')
      setAuditEvents(body.events)
      setNextBeforeId(body.nextBeforeId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotLoadAuditLogs"))
    }
  }, [])

  useEffect(() => {
    let current = true
    jsonRequest<AuditPage>('/api/internal/audit-events?limit=30')
      .then(body => {
        if (!current) return
        setAuditEvents(body.events)
        setNextBeforeId(body.nextBeforeId)
      })
      .catch(cause => {
        if (current) setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotLoadAuditLogs"))
      })
    return () => { current = false }
  }, [])

  const loadMore = async () => {
    if (!nextBeforeId || loading) return
    setLoading(true)
    try {
      const body = await jsonRequest<AuditPage>(`/api/internal/audit-events?limit=30&beforeId=${nextBeforeId}`)
      setAuditEvents(current => [...current, ...body.events])
      setNextBeforeId(body.nextBeforeId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translate("adminPage.couldNotLoadAuditLogs"))
    } finally {
      setLoading(false)
    }
  }

  const columnCount = isNarrow ? 4 : 6

  return (
    <section className="admin-audit">
      <div className="admin-toolbar admin-toolbar--end">
        <button type="button" className="button small" onClick={() => void reload()}>
          <RefreshCw size={14} aria-hidden="true" />
          {translate("common.update")}</button>
      </div>
      {error && <p className="notice error" role="alert">{localizeMessage(error)}</p>}
      {auditEvents.length === 0 ? (
        <p className="state-message">{translate("adminPage.noRecordsYet")}</p>
      ) : (
        <div className="table-scroll">
          <table className="responsive-table audit-table">
            <thead>
              <tr>
                <th scope="col">{translate("adminPage.time")}</th>
                {!isNarrow && <th scope="col">{translate("adminPage.actor")}</th>}
                <th scope="col">{translate("common.actions")}</th>
                {!isNarrow && <th scope="col">{translate("adminPage.resource")}</th>}
                <th scope="col">{translate("adminPage.outcome")}</th>
                <th scope="col" className="responsive-table-toggle"><span className="sr-only">{translate("common.showDetails")}</span></th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map(event => {
                const isOpen = openIds.has(event.id)
                const detailId = `audit-event-${event.id}`
                const changes = event.details?.changes ?? []
                return [
                  <tr
                    key={event.id}
                    className={isOpen ? 'clickable-row selected' : 'clickable-row'}
                    onClick={clickEvent => { if (!isFromControl(clickEvent)) toggleRow(event.id) }}
                  >
                    <td>
                      <time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleString(getIntlLocale(), { hour12: false })}</time>
                    </td>
                    {!isNarrow && <td className="audit-label">{event.actor_label}</td>}
                    <td><span title={event.action}>{ACTION_LABELS[event.action] ?? event.action}</span></td>
                    {!isNarrow && <td className="mono break-word"><AuditTarget event={event} /></td>}
                    <td><span className={`status-badge ${OUTCOME_BADGES[event.outcome]}`}>{OUTCOME_LABELS[event.outcome]}</span></td>
                    <td className="responsive-table-toggle">
                      <RowToggle open={isOpen} controls={detailId} onToggle={() => toggleRow(event.id)} />
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={`${event.id}-details`} id={detailId} className="responsive-table-details">
                      <td colSpan={columnCount}>
                        <dl className="audit-detail">
                          {isNarrow && (
                            <>
                              <div><dt>{translate("adminPage.actor")}</dt><dd>{event.actor_label}</dd></div>
                              <div><dt>{translate("adminPage.resource")}</dt><dd className="mono"><AuditTarget event={event} /></dd></div>
                            </>
                          )}
                          {changes.map((change, index) => (
                            <div key={`${change.field}-${index}`}>
                              <dt>{change.label ?? change.field}</dt>
                              <dd className="audit-change">
                                <del>{formatAuditValue(change.before)}</del>
                                <span aria-hidden="true">→</span>
                                <ins>{formatAuditValue(change.after)}</ins>
                              </dd>
                            </div>
                          ))}
                          {changes.length === 0 && Object.entries(event.details ?? {})
                            .filter(([key]) => key !== 'target')
                            .map(([key, value]) => (
                              <div key={key}><dt>{key}</dt><dd className="mono">{formatAuditValue(value)}</dd></div>
                            ))}
                        </dl>
                        {(!event.details || Object.keys(event.details).length === 0) && (
                          <p className="muted audit-detail__empty">{translate("adminPage.noDetails")}</p>
                        )}
                      </td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
      {nextBeforeId && (
        <div className="admin-more">
          <button type="button" className="button small" disabled={loading} onClick={() => void loadMore()}>
            {loading ? translate("common.loading") : translate("adminPage.showMore")}
          </button>
        </div>
      )}
    </section>
  )
}

export default function AdminPage() {
  useLocale()
  const { user } = useAuth()
  const canUsers = user?.permissions.includes('users:manage') ?? false
  const canAccounts = user?.permissions.includes('service_accounts:manage') ?? false
  const canAudit = user?.permissions.includes('audit:read') ?? false
  const defaultPath = canUsers ? 'users' : canAccounts ? 'service-accounts' : 'audit'

  if (!canUsers && !canAccounts && !canAudit) {
    return <Navigate to="/settings/account" replace />
  }

  return (
    <div className="admin-page">
      <nav className="tabs access-tabs" aria-label={translate('settingsPage.access')}>
        {canUsers && <NavLink to="/settings/access/users" className="tab">{translate("adminPage.users")}</NavLink>}
        {canAccounts && <NavLink to="/settings/access/service-accounts" className="tab">{translate("adminPage.serviceAccounts")}</NavLink>}
        {canAudit && <NavLink to="/settings/access/audit" className="tab">{translate("adminPage.audit")}</NavLink>}
      </nav>
      <Routes>
        <Route index element={<Navigate to={defaultPath} replace />} />
        <Route path="users" element={canUsers ? <UsersPage /> : <Navigate to={defaultPath} replace />} />
        <Route path="service-accounts" element={canAccounts ? <ServiceAccountsPage /> : <Navigate to={defaultPath} replace />} />
        <Route path="audit" element={canAudit ? <AuditPageView /> : <Navigate to={defaultPath} replace />} />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>
    </div>
  )
}
