// Local browser verification only: never accepts a shared/deployed database or external bind.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createPools, closePools } from '../db.js'
import { createUserStore } from '../lib/auth-user-store.js'
import { createAccessTokenStore } from '../lib/access-token-store.js'
import { createServiceAccountStore } from '../lib/auth-api-keys.js'
import { createAuditWriter } from '../lib/audit.js'
import { setSessionPrincipal } from '../lib/rbac.js'
import { SERVICE_KEY_SCOPES } from '../lib/auth-types.js'
import { requireServiceKeyScope } from '../lib/service-key-auth.js'
import { mountAccessTokenRoutes } from '../routes/access-tokens.js'
import { createAccessTokenNamespaceCatalog } from '../lib/access-token-namespaces.js'

const VERIFICATION_DATABASE = 'dashboard_access_tokens_verify'
// Separate from the application's default ports so verification can run beside development.
const VERIFICATION_PORT = 4329
const databaseUrl = process.env.MADO_ACCESS_TOKEN_DATABASE_URL
if (!databaseUrl) throw new Error('Set MADO_ACCESS_TOKEN_DATABASE_URL for the isolated verification database')
const target = new URL(databaseUrl)
if (!['postgres:', 'postgresql:'].includes(target.protocol)
  || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== `/${VERIFICATION_DATABASE}`) {
  throw new Error('Only the dedicated loopback access-token verification database is allowed')
}
const pools = createPools({ rw: databaseUrl, ro: databaseUrl })
try {
  const existing = await pools.rw.query('SELECT id FROM auth_users LIMIT 1')
  if (existing.rowCount) throw new Error('Use a fresh verification database')
  const user = await createUserStore(pools.rw).createUser({
    displayName: 'Verification Admin', username: 'verification-admin', email: 'admin@example.test', roles: ['admin'],
  })
  const store = createAccessTokenStore(pools.rw)
  const credentials = createServiceAccountStore(pools.rw)
  await store.createToken({ name: 'ML Tracking', description: '音声モデルの学習とデータセット参照',
    scopes: ['lineage:read', 'lineage:write'], namespaces: ['speech'], expiresAt: null, createdBy: user.id })
  await store.createToken({ name: '容量監視', description: 'Prometheusから容量を取得',
    scopes: ['metrics:read'], namespaces: [], expiresAt: null, createdBy: user.id })
  const disabled = await store.createToken({ name: '音声前処理', description: '一時停止中の処理',
    scopes: ['lineage:write'], namespaces: ['speech'], expiresAt: null, createdBy: user.id })
  await store.updateToken({ id: disabled.accessToken.id, expectedRevision: 1, patch: { status: 'disabled' } })

  const app = new Hono()
  app.get('/verification', context => context.json({ kind: 'mado-access-tokens', database: VERIFICATION_DATABASE }))
  app.get('/api/auth/config', context => context.json({ localEnabled: true, oidc: { enabled: false } }))
  app.get('/api/auth/me', context => context.json({ user }))
  app.get('/api/internal/connections', context => context.json([]))
  const management = new Hono()
  management.use('*', async (context, next) => {
    setSessionPrincipal(context, { kind: 'user', sessionId: 'verification', user })
    await next()
  })
  mountAccessTokenRoutes(management, { store, audit: createAuditWriter(pools.rw),
    namespaceCatalog: createAccessTokenNamespaceCatalog({ store,
      marquez: { listNamespaces: async () => ['speech', 'podcast', 'vision', 'evaluation', 'training'] } }) })
  app.route('/api/internal', management)
  for (const scope of SERVICE_KEY_SCOPES) {
    app.get(`/verification/probe/${scope}`, requireServiceKeyScope({ authenticate: token => credentials.authenticate(token), scope }),
      context => context.json({ ok: true }))
  }
  const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: VERIFICATION_PORT })
  console.log(`Access-token verification API: http://127.0.0.1:${VERIFICATION_PORT}`)
  function stop() { server.close(() => { void closePools(pools).then(() => process.exit(0)) }) }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
} catch (error) {
  await closePools(pools)
  throw error
}
