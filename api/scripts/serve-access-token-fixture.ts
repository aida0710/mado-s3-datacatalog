// Local browser verification only: never accepts a shared/deployed database or external bind.
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createPools, closePools } from '../db.js'
import { createUserStore } from '../lib/auth-user-store.js'
import { createAccessTokenStore } from '../lib/access-token-store.js'
import { createServiceKeyAuthenticator } from '../lib/service-key-authenticator.js'
import { createAuditWriter } from '../lib/audit.js'
import { getRequestPrincipal } from '../lib/rbac.js'
import { SERVICE_KEY_SCOPES } from '../lib/auth-types.js'
import { requireServiceKeyScope } from '../lib/service-key-auth.js'
import { mountAccessTokenRoutes } from '../routes/access-tokens.js'
import { createAccessTokenNamespaceCatalog } from '../lib/access-token-namespaces.js'
import { createInternalTokenAuthenticator } from '../lib/internal-token-authenticator.js'
import { requireInternalApiAuthentication } from '../lib/internal-api-auth.js'
import { requireInternalApiPermission } from '../lib/internal-api-permission-policy.js'
import { requireConnectionAccess } from '../lib/connection-access.js'
import { auditActivity } from '../lib/audit-activity.js'
import { mountNotesRoutes } from '../routes/notes.js'
import { mountConnectionsRoutes } from '../routes/connections.js'
import { createCrypto } from '../crypto.js'
import { CAPABILITY_KEYS, capabilitySettingKey } from '../storage.js'

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
  const authenticateServiceKey = createServiceKeyAuthenticator(pools.rw)
  const audit = createAuditWriter(pools.rw)
  const fixtureCrypto = createCrypto('a'.repeat(64))
  for (const [id, name] of [['speech0001', 'Speech Storage'], ['backup0001', 'Backup Storage']]) {
    await pools.rw.query(`WITH connection AS (
      INSERT INTO storage_connections
        (id,name,endpoint,access_key_id_enc,secret_access_key_enc,access_key_id_masked)
      VALUES ($1,$2,'https://s3.example.test',$3,$4,'fixture…key') RETURNING id
    )
    INSERT INTO connection_settings (connection_id, key, value)
      SELECT connection.id, key, 'true' FROM connection CROSS JOIN unnest($5::text[]) AS key`,
    [id, name, fixtureCrypto.encrypt('fixture-access-key'), fixtureCrypto.encrypt('fixture-secret'),
      [...CAPABILITY_KEYS.map(capabilitySettingKey), 'scan_enabled', 'capacity_metrics_enabled']])
  }
  await store.createToken({ name: 'ML Tracking', description: '音声モデルの学習とデータセット参照',
    permissions: ['lineage:read', 'lineage:send'], namespaces: ['speech'], connections: [], expiresAt: null, createdBy: user.id })
  await store.createToken({ name: '容量監視', description: 'Prometheusから容量を取得',
    permissions: ['capacity:read'], namespaces: [], connections: ['*'], expiresAt: null, createdBy: user.id })
  const disabled = await store.createToken({ name: '音声前処理', description: '一時停止中の処理',
    permissions: ['lineage:send'], namespaces: ['speech'], connections: [], expiresAt: null, createdBy: user.id })
  await store.updateToken({ id: disabled.accessToken.id, expectedRevision: 1, patch: { status: 'disabled' } })

  const app = new Hono()
  app.get('/verification', context => context.json({ kind: 'mado-access-tokens', database: VERIFICATION_DATABASE }))
  app.get('/api/auth/config', context => context.json({ localEnabled: true, oidc: { enabled: false } }))
  app.get('/api/auth/me', context => {
    context.header('Set-Cookie', 'verification=local-browser-fixture; Path=/; HttpOnly; SameSite=Strict')
    return context.json({ user })
  })
  const management = new Hono()
  management.use('*', requireInternalApiAuthentication({
    authenticateToken: createInternalTokenAuthenticator({ pool: pools.rw, authenticate: authenticateServiceKey }),
    sessions: { authenticateSession: async () => ({ kind: 'user', sessionId: 'verification', user }) },
    cookieName: 'verification', idleSeconds: 300,
  }))
  management.use('*', auditActivity(audit))
  management.use('*', requireInternalApiPermission())
  management.use('/storage/:connectionId/*', requireConnectionAccess(pools.ro))
  management.use('/connections/:connectionId', (context, next) => getRequestPrincipal(context)?.kind === 'service_account'
    ? requireConnectionAccess(pools.ro)(context, next) : next())
  management.get('/storage/:connectionId/buckets', context => context.json([{ name: 'fixture-dataset' }]))
  mountConnectionsRoutes(management, { pools, crypto: fixtureCrypto, invalidate: () => {} })
  mountNotesRoutes(management, { pools })
  mountAccessTokenRoutes(management, { store, audit,
    namespaceCatalog: createAccessTokenNamespaceCatalog({ store,
      marquez: { listNamespaces: async () => ['speech', 'podcast', 'vision', 'evaluation', 'training'] } }) })
  app.route('/api/internal', management)
  for (const scope of SERVICE_KEY_SCOPES) {
    app.get(`/verification/probe/${scope}`, requireServiceKeyScope({ authenticate: authenticateServiceKey, scope }),
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
