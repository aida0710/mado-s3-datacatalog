import { z } from 'zod'
import { assertNoRenamedEnvironmentVariables } from './renamed-environment-variables.js'

// ブラウザを離れている間も含めて、ログインを1週間保つ。
const DEFAULT_SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60
// offline_accessがあると、SSOのsessionは期限の短いアクセストークンをログインし直さずに更新できる。
const DEFAULT_OIDC_SCOPES = 'openid email profile offline_access'

// `MDC_STORAGE_SECRET_KEY` は 64 桁の16進数 (32 バイトのエントロピー) が必須。
// `openssl rand -hex 32` で生成できる。
const hex32 = (name: string) =>
  z.string().regex(/^[0-9a-fA-F]{64}$/, `${name} must be 64 hex chars (32 bytes)`)

const booleanString = z.enum(['true', 'false', '1', '0'])
const roleId = z.enum(['viewer', 'curator', 'operator', 'admin'])
const emptyStringAsUndefined = z.literal('').transform(() => undefined)
const optionalString = z.union([z.string().min(1), emptyStringAsUndefined]).optional()
const optionalUrl = z.union([z.string().url(), emptyStringAsUndefined]).optional()
const oidcRoleMapping = z.string().default('{}').transform((value, ctx): Record<string, z.infer<typeof roleId>> => {
  try {
    const parsed = z.record(z.string().min(1), roleId).parse(JSON.parse(value))
    return parsed
  } catch {
    ctx.addIssue({ code: 'custom', message: 'MDC_OIDC_ROLE_MAPPING_JSON must be a JSON object mapping group names to Mado roles' })
    return z.NEVER
  }
})

const baseSchema = z.object({
  MDC_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MDC_PORT: z.coerce.number().default(3000),
  MDC_DATABASE_URL_RW: z.string().min(1),
  MDC_DATABASE_URL_RO: z.string().min(1),
  // DB の管理者 (postgres) の接続。api-internal が起動時に未適用の移行を当てるときだけ使う。
  // 移行はロールの作成や所有者の変更を含むので、dashboard_rw では当てられない。
  MDC_DATABASE_URL_MIGRATE: z.string().min(1),
  MDC_TEST_DATABASE_URL: optionalString,
  MDC_STORAGE_SECRET_KEY: hex32('MDC_STORAGE_SECRET_KEY'),
  // CSRF 防御: /api/internal/* の write 系で許容する Origin (カンマ区切り)。
  // 例: dev = "http://localhost:5173"、prod = "http://lab-server"。
  // 設定漏れを早期検知するため必須化 (default なし)。
  // refine で「,, , 」のように空要素しか含まない値も拒否する (transform 後に長さチェック)。
  MDC_WEB_ORIGIN: z.string().min(1).transform(s =>
    s.split(',').map(o => o.trim()).filter(Boolean)
  ).refine(arr => arr.length > 0, {
    message: 'MDC_WEB_ORIGIN must contain at least one non-empty origin',
  }),
  MDC_PREVIEW_TEXT_LIMIT: z.coerce.number().default(65536),
  MDC_PREVIEW_TAR_ENTRY_LIMIT: z.coerce.number().default(200),
  MDC_PREVIEW_TARXZ_BYTE_LIMIT: z.coerce.number().default(268435456),
  // 圧縮tarの本文バッファと先頭取得の上限。非圧縮tarの本文配信には適用しない。
  MDC_PREVIEW_TAR_ENTRY_MAX_BYTES: z.coerce.number().default(104857600),
  // media-worker (波形/スペクトログラム解析) 関連。全て default 付きで
  // 既存デプロイの .env を変更せずに済む。
  MDC_MEDIA_CONCURRENCY: z.coerce.number().default(3),
  MDC_MEDIA_ANALYZE_TIMEOUT_SEC: z.coerce.number().default(300),
  MDC_MEDIA_CACHE_MAX_AGE_DAYS: z.coerce.number().default(30),
  MDC_MEDIA_SPECTROGRAM_MAX_WIDTH: z.coerce.number().default(4096),
  MDC_MEDIA_WORKER_PORT: z.coerce.number().default(3100),
  MDC_MEDIA_WORKER_URL: z.string().default('http://media-worker:3100'),

  MDC_AUTH_MODE: z.enum(['local', 'oidc', 'hybrid']),
  MDC_AUTH_COOKIE_SECURE: booleanString.default('false').transform(value =>
    value === 'true' || value === '1'
  ),
  MDC_AUTH_SESSION_IDLE_SECONDS: z.coerce.number().int().min(300).default(DEFAULT_SESSION_LIFETIME_SECONDS),
  MDC_AUTH_SESSION_ABSOLUTE_SECONDS: z.coerce.number().int().min(3600).default(DEFAULT_SESSION_LIFETIME_SECONDS),
  MDC_OIDC_ISSUER_URL: optionalUrl,
  MDC_OIDC_CLIENT_ID: optionalString,
  MDC_OIDC_CLIENT_SECRET: optionalString,
  MDC_OIDC_REDIRECT_URI: optionalUrl,
  MDC_OIDC_LABEL: z.string().min(1).default('SSO'),
  MDC_OIDC_SCOPES: z.string().min(1).default(DEFAULT_OIDC_SCOPES),
  MDC_OIDC_POST_LOGOUT_REDIRECT_URI: optionalUrl,
  MDC_OIDC_AUTO_LINK_VERIFIED_EMAIL: booleanString.default('false').transform(value =>
    value === 'true' || value === '1'
  ),
  MDC_OIDC_ALLOWED_GROUPS: z.string().default('').transform(value =>
    [...new Set(value.split(',').map(group => group.trim()).filter(Boolean))]
  ),
  MDC_OIDC_ROLE_MAPPING_JSON: oidcRoleMapping,
  MDC_OIDC_DEFAULT_ROLE: roleId.default('viewer'),

  // Dataset Registryがmetadataの正本、Marquezはread-only projection。
  // 3値が揃った場合だけinternal UIにlineage routeをmountする。
  MDC_DATASET_REGISTRY_URL: optionalUrl,
  MDC_DATASET_REGISTRY_TOKEN: z.union([
    z.string().min(16), emptyStringAsUndefined,
  ]).optional(),
  MDC_MARQUEZ_URL: optionalUrl,
  MDC_LINEAGE_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MDC_OPENLINEAGE_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).default(2 * 1024 * 1024),
})

const schema = baseSchema.superRefine((env, ctx) => {
  if ((env.MDC_AUTH_MODE === 'oidc' || env.MDC_AUTH_MODE === 'hybrid') && env.MDC_OIDC_ALLOWED_GROUPS.length === 0) {
    ctx.addIssue({
      code: 'custom', path: ['MDC_OIDC_ALLOWED_GROUPS'],
      message: 'MDC_OIDC_ALLOWED_GROUPS is required when OIDC is enabled',
    })
  }
})

export type Env = z.infer<typeof schema>

// compose内の解析workerにはブラウザ認証やRegistryの設定を渡さない。
const workerSchema = baseSchema.pick({
  MDC_ENV: true, MDC_DATABASE_URL_RW: true, MDC_DATABASE_URL_RO: true, MDC_STORAGE_SECRET_KEY: true,
  MDC_MEDIA_CONCURRENCY: true, MDC_MEDIA_ANALYZE_TIMEOUT_SEC: true, MDC_MEDIA_CACHE_MAX_AGE_DAYS: true,
  MDC_MEDIA_SPECTROGRAM_MAX_WIDTH: true, MDC_MEDIA_WORKER_PORT: true,
})
export type WorkerEnv = z.infer<typeof workerSchema>

const lineageSchema = z.object({
  MDC_DATABASE_URL_RW: z.string().min(1),
  MDC_DATABASE_URL_RO: z.string().min(1),
  MDC_DATASET_REGISTRY_URL: z.string().url(),
  MDC_DATASET_REGISTRY_TOKEN: z.string().min(16),
  MDC_LINEAGE_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MDC_OPENLINEAGE_BODY_LIMIT_BYTES: z.coerce.number().int().min(1024).default(2 * 1024 * 1024),
})

export type LineageEnv = z.infer<typeof lineageSchema>

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return parseEnvironment(schema, source, 'environment')
}

export function loadWorkerEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  return parseEnvironment(workerSchema, source, 'worker environment')
}

function parseEnvironment<T>(environmentSchema: z.ZodType<T>, source: Record<string, string | undefined>, label: string): T {
  // 旧名だけが残っていると、必須の値は「無い」と言われ、任意の値は黙って既定値になる。替えるべき名前を先に示して止める。
  assertNoRenamedEnvironmentVariables(source)
  const parsed = environmentSchema.safeParse(source)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid ${label}:\n${msg}`)
  }
  return parsed.data
}

/** Internet-facing lineage processへbrowser/storage用secretを渡さないための最小schema。 */
export function loadLineageEnv(
  source: Record<string, string | undefined> = process.env,
): LineageEnv {
  return parseEnvironment(lineageSchema, source, 'lineage environment')
}
