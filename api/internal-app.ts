import { Hono, type Context } from 'hono'
import { createPools } from './db.js'
import { createCrypto } from './crypto.js'
import { createStorageFactory } from './storage.js'
import { requireSafeOrigin } from './lib/originCheck.js'
import { mountStorageCapabilityGuards } from './lib/storage-capability-routes.js'
import {
  canAccessConnection, connectionIdsForPrincipal, requireConnectionAccess, requireConnectionQueryAccess, visibleConnectionIds,
} from './lib/connection-access.js'
import { explainStorageError } from './lib/storageError.js'
import { mountStorageListRoutes } from './routes/storage-list.js'
import { createResponseCache } from './lib/storage-cache.js'
import { createJobStore } from './lib/jobs.js'
import { mountJobRoutes } from './routes/jobs.js'
import { mountStorageScanRoutes } from './routes/storage-scan.js'
import { mountStorageEstimateRoutes } from './routes/storage-estimate.js'
import { mountPricingRoutes } from './routes/pricing.js'
import { createPricingStore } from './lib/pricing-store.js'
import { mountStorageReadmeRoutes } from './routes/storage-readme.js'
import { mountStoragePreviewRoutes } from './routes/storage-preview.js'
import { mountStorageMediaRoutes } from './routes/storage-media.js'
import { mountStorageFavoritesRoutes } from './routes/storage-favorites.js'
import { mountConnectionsRoutes } from './routes/connections.js'
import { mountNotesRoutes } from './routes/notes.js'
import { mountStorageTagsRoutes } from './routes/storage-tags.js'
import { mountSettingsRoutes } from './routes/settings.js'
import { createUserStore } from './lib/auth-user-store.js'
import { createCredentialStore } from './lib/auth-credential-store.js'
import { createSessionStore } from './lib/auth-session-store.js'
import { createOidcSessionVerifier, OidcSessionCheckUnavailableError } from './lib/auth-oidc-session.js'
import { RequestQueueFullError } from './lib/shared-requests.js'
import { createOidcProvisioning } from './lib/auth-oidc-provisioning.js'
import { sessionCookieName } from './lib/auth-types.js'
import { createAuditWriter } from './lib/audit.js'
import { auditActivity } from './lib/audit-activity.js'
import { createServiceKeyAuthenticator } from './lib/service-key-authenticator.js'
import { createOidcProvider } from './lib/auth-oidc.js'
import { requirePasswordChangeComplete } from './lib/auth-middleware.js'
import { requireInternalApiAuthentication } from './lib/internal-api-auth.js'
import { createInternalTokenAuthenticator } from './lib/internal-token-authenticator.js'
import { requireInternalApiPermission } from './lib/internal-api-permission-policy.js'
import { getRequestPrincipal } from './lib/rbac.js'
import { mountAuthRoutes } from './routes/auth.js'
import { mountAdminUsersRoutes } from './routes/admin-users.js'
import { mountAccessTokenRoutes } from './routes/access-tokens.js'
import { createAccessTokenStore } from './lib/access-token-store.js'
import { createAccessTokenNamespaceCatalog } from './lib/access-token-namespaces.js'
import { mountAuditRoutes } from './routes/audit.js'
import { createRegistryClient } from './lib/registry-client.js'
import { createMarquezClient } from './lib/marquez-client.js'
import { createLineageService, type StorageBindingResolver } from './lib/lineage-service.js'
import { mountLineageRoutes } from './routes/lineage.js'
import { createNamespaceLineagePolicy } from './lib/namespace-lineage-policy.js'
import { mountLineageCurationRoutes } from './routes/lineage-curation.js'
import { requestLogger } from './lib/request-logger.js'
import { mountHealthRoute } from './lib/health-route.js'
import { createCapacityStore } from './lib/capacity-store.js'
import { mountStorageCapacityRoutes } from './routes/storage-capacity.js'
import { listStorageBucketNames } from './lib/storage-buckets.js'
import { createCapacityMetricsCollector } from './lib/capacity-metrics.js'
import { mountMetricsRoutes } from './routes/metrics.js'
import { mountServiceAccessTokenRoutes } from './routes/service-access-token.js'
import { mountServiceLineageRoutes } from './routes/service-lineage.js'
import { apiError } from './lib/api-error.js'
import type { Env } from './env.js'

/**
 * ブラウザと連携用の内部 API (api-internal) の Hono アプリを組み立てる。待ち受け・移行・定期処理は起動側 (internal.ts) が持つ。
 * DB にはつながずに組めるので、ルートの一覧を読むテスト (OpenAPI の突き合わせ) からも使う。
 */
export function createInternalApplication(env: Env) {
  const pools = createPools({ rw: env.DATABASE_URL_RW, ro: env.DATABASE_URL_RO })
  const crypto = createCrypto(env.ENCRYPTION_KEY)
  const storageFactory = createStorageFactory({ pools, crypto })
  const audit = createAuditWriter(pools.rw)
  const users = createUserStore(pools.rw)
  const credentials = createCredentialStore(pools.rw)
  const authenticateServiceKey = createServiceKeyAuthenticator(pools.rw)
  const authenticateInternalToken = createInternalTokenAuthenticator({ pool: pools.rw, authenticate: authenticateServiceKey })
  const sessionCookie = sessionCookieName(env.AUTH_COOKIE_SECURE)
  const oidcEnabled = env.AUTH_MODE === 'oidc' || env.AUTH_MODE === 'hybrid'
  if (oidcEnabled && (!env.OIDC_ISSUER_URL || !env.OIDC_CLIENT_ID
      || !env.OIDC_CLIENT_SECRET || !env.OIDC_REDIRECT_URI)) {
    throw new Error('AUTH_MODE enables OIDC but OIDC_ISSUER_URL/CLIENT_ID/CLIENT_SECRET/REDIRECT_URI is incomplete')
  }
  const oidc = oidcEnabled ? createOidcProvider(pools.rw, crypto, {
    id: 'primary',
    label: env.OIDC_LABEL,
    issuerUrl: env.OIDC_ISSUER_URL!,
    clientId: env.OIDC_CLIENT_ID!,
    clientSecret: env.OIDC_CLIENT_SECRET!,
    redirectUri: env.OIDC_REDIRECT_URI!,
    scopes: env.OIDC_SCOPES,
    postLogoutRedirectUri: env.OIDC_POST_LOGOUT_REDIRECT_URI,
  }) : undefined
  const sessions = createSessionStore(pools.rw, audit, oidc ? createOidcSessionVerifier({
    pool: pools.rw, crypto, provider: oidc, audit,
    policy: { allowedGroups: env.OIDC_ALLOWED_GROUPS, roleMapping: env.OIDC_ROLE_MAPPING_JSON, defaultRole: env.OIDC_DEFAULT_ROLE },
  }) : undefined)
  /** 期限切れの session・ログアウトの記録・OIDC の attempt を消す。起動側が定期的に呼ぶ。 */
  const deleteExpiredAuthRecords = async (): Promise<void> => {
    await Promise.all([
      sessions.deleteExpiredSessions(),
      sessions.deleteExpiredLogoutEvents(),
      oidc?.deleteExpiredAttempts(),
    ])
  }

  // 応答キャッシュは書き込みを伴うので rw プールを使う。書き込み先は
  // storage_response_cache の 1 テーブルのみ (spec の「ロールについての判断」)。
  const responseCache = createResponseCache(pools.rw)
  const jobStore = createJobStore(pools)
  // 料金カタログ (同梱 → DB キャッシュ → プロセス内メモリの 3 層)。
  // 取得そのものは worker の pricing.refresh ジョブが行う。
  const pricingStore = createPricingStore(pools)
  const capacityStore = createCapacityStore(pools)

  const app = new Hono()
  // ヘルスチェックは数秒ごとに来るので、要求のログより先に付けてログに出さない。
  mountHealthRoute(app, pools.ro)
  app.use('*', requestLogger())

  // Login/callbackはbrowser session確立前に到達するpublic route。write系には既存の
  // Origin検証を適用する。
  const authApi = new Hono()
  const safeOrigin = requireSafeOrigin(env.ALLOWED_ORIGINS)
  authApi.use('*', async (c, next) => {
    // AuthentikからのBack-channel logoutはbrowser Originを持たない代わりに、
    // ProviderのJWKSで署名されたlogout_tokenをhandler内で検証する。
    if (c.req.path.endsWith('/oidc/backchannel-logout')) return next()
    return safeOrigin(c, next)
  })
  mountAuthRoutes(authApi, {
    crypto,
    users,
    credentials,
    sessions,
    oidcProvisioning: createOidcProvisioning(pools.rw, audit),
    audit,
    config: {
      localEnabled: env.AUTH_MODE === 'local' || env.AUTH_MODE === 'hybrid',
      session: {
        idleSeconds: env.AUTH_SESSION_IDLE_SECONDS,
        absoluteSeconds: env.AUTH_SESSION_ABSOLUTE_SECONDS,
        secure: env.AUTH_COOKIE_SECURE,
      },
      oidc,
      oidcLoginPolicy: {
        autoLinkVerifiedEmail: env.OIDC_AUTO_LINK_VERIFIED_EMAIL,
        allowedGroups: env.OIDC_ALLOWED_GROUPS,
        roleMapping: env.OIDC_ROLE_MAPPING_JSON,
        defaultRole: env.OIDC_DEFAULT_ROLE,
      },
    },
  })
  app.route('/api/auth', authApi)

  const api = new Hono()
  const safeInternalOrigin = requireSafeOrigin(env.ALLOWED_ORIGINS)
  // ブラウザからの要求は、セッションに触れる(有効期限を延ばす)前にOriginを確かめる。
  // Authorizationヘッダーは他サイトのフォームからは付けられないので、トークンの要求には要らない。
  api.use('*', (context, next) => context.req.header('Authorization') !== undefined
    ? next() : safeInternalOrigin(context, next))
  api.use('*', requireInternalApiAuthentication({ sessions, authenticateToken: authenticateInternalToken,
    idleSeconds: env.AUTH_SESSION_IDLE_SECONDS, cookieName: sessionCookie }))
  api.use('*', auditActivity(audit))
  api.use('*', requirePasswordChangeComplete())
  api.use('*', requireInternalApiPermission())

  // ホワイトリスト接続は、一覧から隠すだけでなく全Storage APIのURL直打ちも遮断する。
  // 非許可Userへは存在を明かさないため403ではなく404を返す。
  api.use('/storage/:connectionId/*', requireConnectionAccess(pools.ro))
  api.use('/connections/:connectionId', async (context, next) => {
    if (getRequestPrincipal(context)?.kind !== 'service_account') return next()
    return requireConnectionAccess(pools.ro)(context, next)
  })
  api.use('/lineage/resolve-location', requireConnectionQueryAccess(pools.ro))

  // 接続ごとの権限ガード。対応表は lib/storage-capability-routes.ts の 1 箇所にある。
  // Hono は登録順に実行するので、必ずルートの mount より前に登録すること。
  mountStorageCapabilityGuards(api, storageFactory.getConnectionConfig)

  mountConnectionsRoutes(api, {
    pools,
    crypto,
    invalidate: (id: string) => {
      storageFactory.invalidate(id)
      // endpoint や list_objects_version が変われば応答が変わるので、
      // この接続の一覧キャッシュは全部捨てる。await しないのは既存の
      // invalidate が同期シグネチャのため (失敗は内部でログ済み)。
      void responseCache.invalidateConnection(id)
    },
  })
  mountStorageListRoutes(api, {
    getStorage: storageFactory.getStorage,
    getConnectionConfig: storageFactory.getConnectionConfig,
    cache: responseCache,
  })
  mountStorageReadmeRoutes(api, { getStorage: storageFactory.getStorage, pools, cache: responseCache })
  mountStoragePreviewRoutes(api, { getStorage: storageFactory.getStorage, env })
  mountStorageMediaRoutes(api, {
    getStorage: storageFactory.getStorage,
    pools,
    env,
  })
  mountJobRoutes(api, {
    store: jobStore,
    canAccessConnection: (c, connectionId) => canAccessConnection(pools.ro, c, connectionId),
    getConnectionConfig: storageFactory.getConnectionConfig,
  })
  mountStorageScanRoutes(api, { store: jobStore, getConnectionConfig: storageFactory.getConnectionConfig })
  mountStorageCapacityRoutes(api, {
    store: capacityStore,
    jobs: jobStore,
    pools,
    getConnectionConfig: storageFactory.getConnectionConfig,
    listBuckets: connectionId => listStorageBucketNames(storageFactory.getStorage, connectionId),
  })
  // 見積もりは S3 を叩かないので接続ごとの権限ガードには載せない (lib/storage-capability-routes.ts)。
  mountStorageEstimateRoutes(api, { pools, store: jobStore, pricing: pricingStore })
  mountPricingRoutes(api, { pools, store: jobStore, pricing: pricingStore })
  mountStorageFavoritesRoutes(api, { pools })
  mountSettingsRoutes(api, { pools })
  mountNotesRoutes(api, { pools })
  mountStorageTagsRoutes(api, { pools })

  if (env.DATASET_REGISTRY_URL && env.DATASET_REGISTRY_TOKEN && env.MARQUEZ_URL) {
    const registry = createRegistryClient({
      baseUrl: env.DATASET_REGISTRY_URL,
      token: env.DATASET_REGISTRY_TOKEN,
    })
    const marquez = createMarquezClient({ baseUrl: env.MARQUEZ_URL })
    const bindings: StorageBindingResolver = {
      async resolve(keys) {
        if (keys.length === 0) return new Map()
        const result = await pools.ro.query<{
          registry_storage_system_key: string
          connection_id: string
        }>(
          `SELECT registry_storage_system_key, connection_id
             FROM lineage_storage_bindings
            WHERE registry_storage_system_key = ANY($1::text[])`,
          [[...keys]],
        )
        return new Map(result.rows.map(row => [row.registry_storage_system_key, row.connection_id]))
      },
      async keyForConnection(connectionId) {
        const result = await pools.ro.query<{ registry_storage_system_key: string }>(
          `SELECT registry_storage_system_key
             FROM lineage_storage_bindings
            WHERE connection_id = $1`,
          [connectionId],
        )
        return result.rows[0]?.registry_storage_system_key ?? null
      },
    }
    const namespacePolicy = (context: Context) => {
      const principal = getRequestPrincipal(context)
      return principal?.kind === 'service_account' ? createNamespaceLineagePolicy(registry, principal.namespaces) : null
    }
    mountLineageRoutes(api, {
      namespacePolicy,
      service: createLineageService({ registry, marquez, bindings }),
      visibleConnectionIds: c => visibleConnectionIds(pools.ro, c),
    })
    mountLineageCurationRoutes(api, {
      namespacePolicy,
      registry,
      pool: pools.ro,
      audit,
      canAccessConnection: (c, connectionId) => canAccessConnection(pools.ro, c, connectionId),
      visibleConnectionIds: c => visibleConnectionIds(pools.ro, c),
    })
  } else {
    api.all('/lineage/*', c => c.json(apiError('lineage_not_configured', 'lineage integration is not configured'), 503))
  }

  mountAdminUsersRoutes(api, {
    users,
    credentials,
    audit,
    ssoRoleMapping: env.OIDC_ROLE_MAPPING_JSON,
  })
  const accessTokens = createAccessTokenStore(pools.rw)
  mountAccessTokenRoutes(api, { store: accessTokens, audit,
    visibleConnections: principal => connectionIdsForPrincipal(pools.ro, principal),
    namespaceCatalog: createAccessTokenNamespaceCatalog({ store: accessTokens,
      marquez: env.MARQUEZ_URL ? createMarquezClient({ baseUrl: env.MARQUEZ_URL }) : null }) })
  mountAuditRoutes(api, { pool: pools.ro })

  app.route('/api/internal', api)

  // 連携用の読み取りAPI。既存のscopeとURLを維持し、公開用の:8081には載せない。
  const madoApi = new Hono()
  mountServiceAccessTokenRoutes(madoApi, { authenticate: authenticateServiceKey })
  mountMetricsRoutes(madoApi, {
    authenticate: authenticateInternalToken,
    collectors: [createCapacityMetricsCollector(capacityStore)],
  })
  mountServiceLineageRoutes(madoApi, {
    authenticate: authenticateServiceKey,
    registry: env.DATASET_REGISTRY_URL && env.DATASET_REGISTRY_TOKEN
      ? createRegistryClient({ baseUrl: env.DATASET_REGISTRY_URL, token: env.DATASET_REGISTRY_TOKEN })
      : null,
  })
  app.route('/api/mado', madoApi)

  // 未 catch のエラーをユーザフレンドリーに翻訳する。S3 系は 502 + 短い説明、
  // それ以外は内部 error をログに出して 500 + "internal error" だけ返す
  // (raw error.message を漏らさない)。
  app.onError((err, c) => {
    if (err instanceof OidcSessionCheckUnavailableError) {
      return c.json(apiError('oidc_unavailable', err.message), 503, { 'Retry-After': '1' })
    }
    if (err instanceof RequestQueueFullError) {
      return c.json(apiError('request_queue_full', err.message), 503, { 'Retry-After': '1' })
    }
    const explained = explainStorageError(err)
    if (explained) {
      const storageError = err as { name?: string; $metadata?: { httpStatusCode?: number; requestId?: string } }
      console.error('storage error', {
        name: storageError.name ?? 'unknown',
        upstreamStatus: storageError.$metadata?.httpStatusCode ?? null,
        upstreamRequestId: storageError.$metadata?.requestId ?? null,
      })
      return c.json(apiError(explained.code, explained.message), explained.status)
    }
    console.error('unhandled error', err)
    return c.json(apiError('internal_error', 'internal error'), 500)
  })

  return { app, pools, storageFactory, deleteExpiredAuthRecords }
}
