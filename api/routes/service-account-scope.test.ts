import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import type { ServiceAccountStore } from '../lib/auth-api-keys.js'
import type { AuditWriter } from '../lib/audit.js'
import { setSessionPrincipal } from '../lib/rbac.js'
import { mountServiceAccountRoutes } from './service-accounts.js'

const accountId = '930848cd-400e-49c2-8c57-d5d433239a45'
function application(permissions = ['service_accounts:manage']) {
  const issueKey = vi.fn(async (input: { scopes: string[]; namespaces: string[] }) => ({
    id: '77a8f11c-a1cb-4bc8-b396-7bb26415f1b7', ...input, tokenPrefix: 'test-fixture',
  }))
  const store = { issueKey } as unknown as ServiceAccountStore
  const audit = { write: vi.fn(async () => undefined) } as unknown as AuditWriter
  const app = new Hono()
  app.use('*', async (context, next) => {
    setSessionPrincipal(context, { kind: 'user', sessionId: 'fixture', user: {
      id: accountId, username: null, email: 'admin@example.test', displayName: 'Admin',
      signatureName: 'Admin', status: 'active', roles: ['admin'], permissions,
      mustChangePassword: false, authMethods: ['sso'],
    } })
    await next()
  })
  mountServiceAccountRoutes(app, { store, audit })
  const issue = (body: unknown) => app.request(`/service-accounts/${accountId}/keys`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { issue, issueKey, audit }
}

describe('Service Accountの新しいread scope', () => {
  it('lineage:readはNamespaceを指定して発行し、監査に用途を記録する', async () => {
    const { issue, issueKey, audit } = application()
    expect((await issue({ name: 'tracking catalog', scopes: ['lineage:read'], namespaces: ['speech'] })).status).toBe(201)
    expect(issueKey).toHaveBeenCalledWith(expect.objectContaining({ scopes: ['lineage:read'], namespaces: ['speech'] }))
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'service_account.key.issue', details: expect.objectContaining({ scopes: ['lineage:read'] }) }))
  })
  it('Namespaceのないread key、metricsへNamespaceを付けたkey、複数用途keyは発行しない', async () => {
    const { issue, issueKey } = application()
    for (const body of [
      { name: 'missing', scopes: ['lineage:read'] },
      { name: 'metrics namespace', scopes: ['metrics:read'], namespaces: ['speech'] },
      { name: 'mixed', scopes: ['lineage:read', 'lineage:write'], namespaces: ['speech'] },
    ]) expect((await issue(body)).status).toBe(400)
    expect(issueKey).not.toHaveBeenCalled()
  })
  it('管理権限のない利用者はread keyを発行しない', async () => {
    const { issue, issueKey } = application([])
    expect((await issue({ name: 'tracking', scopes: ['lineage:read'], namespaces: ['speech'] })).status).toBe(403)
    expect(issueKey).not.toHaveBeenCalled()
  })
})
