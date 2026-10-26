import { describe, expect, it } from 'vitest'
import { loadEnv, loadLineageEnv, loadWorkerEnv } from './env.js'

const VALID_KEY = '0'.repeat(64)

describe('loadEnv', () => {
  it('必須の環境変数を読める', () => {
    const env = loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_PORT: '3000',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: VALID_KEY,
      MDC_WEB_ORIGIN: 'http://localhost:5173',
    })
    expect(env.MDC_PORT).toBe(3000)
    expect(env.MDC_ENV).toBe('development')
    expect(env.MDC_STORAGE_SECRET_KEY).toBe(VALID_KEY)
    expect(env.MDC_WEB_ORIGIN).toEqual(['http://localhost:5173'])
    expect(env.MDC_PREVIEW_TEXT_LIMIT).toBe(65536) // デフォルト値
    expect(env.MDC_PREVIEW_TAR_ENTRY_LIMIT).toBe(200)
    expect(env.MDC_PREVIEW_TAR_ENTRY_MAX_BYTES).toBe(100 * 1024 * 1024)
    expect(env.MDC_AUTH_MODE).toBe('local')
    expect(env.MDC_AUTH_COOKIE_SECURE).toBe(false)
    expect(env.MDC_AUTH_SESSION_IDLE_SECONDS).toBe(604800)
    expect(env.MDC_AUTH_SESSION_ABSOLUTE_SECONDS).toBe(604800)
    expect(env.MDC_OIDC_SCOPES).toBe('openid email profile offline_access')
  })

  it('MDC_WEB_ORIGIN はカンマで分け、空白を除き、空要素を落とす', () => {
    const env = loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: VALID_KEY,
      MDC_WEB_ORIGIN: 'http://localhost:5173, http://lab-server ,',
    })
    expect(env.MDC_WEB_ORIGIN).toEqual([
      'http://localhost:5173',
      'http://lab-server',
    ])
  })

  it('MDC_WEB_ORIGIN が無ければ throw する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_PORT: '3000',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: VALID_KEY,
    })).toThrow(/MDC_WEB_ORIGIN/)
  })

  it('MDC_WEB_ORIGIN がカンマと空白だけなら空とみなして throw する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: VALID_KEY,
      MDC_WEB_ORIGIN: ' , , ,',
    })).toThrow(/MDC_WEB_ORIGIN/)
  })

  it('必須変数が無ければ throw する', () => {
    expect(() => loadEnv({ MDC_PORT: '3000' })).toThrow(/MDC_DATABASE_URL_RW/)
  })

  it('移行を当てる管理者の接続 MDC_DATABASE_URL_MIGRATE が無ければ throw する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: VALID_KEY,
      MDC_WEB_ORIGIN: 'http://localhost:5173',
    })).toThrow(/MDC_DATABASE_URL_MIGRATE/)
  })

  it('MDC_STORAGE_SECRET_KEY が無ければ throw する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_PORT: '3000',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_WEB_ORIGIN: 'http://localhost:5173',
    })).toThrow(/MDC_STORAGE_SECRET_KEY/)
  })

  it('MDC_STORAGE_SECRET_KEY の長さが違えば throw する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_PORT: '3000',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: 'abc',
      MDC_WEB_ORIGIN: 'http://localhost:5173',
    })).toThrow(/MDC_STORAGE_SECRET_KEY/)
  })

  it('MDC_STORAGE_SECRET_KEY に hex 以外の文字があれば throw する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_PORT: '3000',
      MDC_DATABASE_URL_RW: 'postgres://rw@localhost/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://ro@localhost/dashboard',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: 'z'.repeat(64),
      MDC_WEB_ORIGIN: 'http://localhost:5173',
    })).toThrow(/MDC_STORAGE_SECRET_KEY/)
  })

  it('MDC_MEDIA_* は default 値で読める', () => {
    const env = loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'http://localhost:5173',
    })
    expect(env.MDC_MEDIA_CONCURRENCY).toBe(3)
    expect(env.MDC_MEDIA_ANALYZE_TIMEOUT_SEC).toBe(300)
    expect(env.MDC_MEDIA_CACHE_MAX_AGE_DAYS).toBe(30)
    expect(env.MDC_MEDIA_SPECTROGRAM_MAX_WIDTH).toBe(4096)
    expect(env.MDC_MEDIA_WORKER_PORT).toBe(3100)
    expect(env.MDC_MEDIA_WORKER_URL).toBe('http://media-worker:3100')
  })

  it('boolean文字列のfalseをtrueとして扱わない', () => {
    const env = loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'http://localhost:5173',
      MDC_AUTH_COOKIE_SECURE: 'false',
    })
    expect(env.MDC_AUTH_COOKIE_SECURE).toBe(false)
  })

  it('OIDC groupのallow listとrole mappingを検証してparseする', () => {
    const env = loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'https://mado.example',
      MDC_OIDC_ALLOWED_GROUPS: 'mado-users, mado-admins,mado-users',
      MDC_OIDC_ROLE_MAPPING_JSON: '{"mado-admins":"admin","mado-users":"viewer"}',
      MDC_OIDC_AUTO_LINK_VERIFIED_EMAIL: 'true',
    })
    expect(env.MDC_OIDC_ALLOWED_GROUPS).toEqual(['mado-users', 'mado-admins'])
    expect(env.MDC_OIDC_ROLE_MAPPING_JSON).toEqual({ 'mado-admins': 'admin', 'mado-users': 'viewer' })
    expect(env.MDC_OIDC_AUTO_LINK_VERIFIED_EMAIL).toBe(true)
  })

  it('存在しないMado roleへのOIDC mappingを拒否する', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'https://mado.example',
      MDC_OIDC_ROLE_MAPPING_JSON: '{"mado-users":"owner"}',
    })).toThrow(/MDC_OIDC_ROLE_MAPPING_JSON/)
  })

  it.each(['development', 'test', 'production'])('%sで認証無効を指定すると起動エラーになる', environment => {
    expect(() => loadEnv({
      MDC_ENV: environment,
      MDC_AUTH_MODE: 'disabled',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'https://mado.example',
    })).toThrow(/MDC_AUTH_MODE/)
  })

  it.each([undefined, '', 'required'])('認証方式が %s なら起動エラーになる', mode => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: mode, MDC_DATABASE_URL_RW: 'postgres://x', MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: VALID_KEY, MDC_WEB_ORIGIN: 'https://mado.example',
    })).toThrow(/MDC_AUTH_MODE/)
  })

  it('productionでも認証を明示すれば起動できる', () => {
    const env = loadEnv({
      MDC_ENV: 'production',
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'http://mado.internal',
    })
    expect(env.MDC_AUTH_MODE).toBe('local')
  })

  it('local authのrelease設定では未使用optional値の空文字を未設定として扱う', () => {
    const env = loadEnv({
      MDC_ENV: 'production',
      MDC_AUTH_MODE: 'local',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_TEST_DATABASE_URL: '',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'https://mado.example',
      MDC_OIDC_ISSUER_URL: '',
      MDC_OIDC_CLIENT_ID: '',
      MDC_OIDC_CLIENT_SECRET: '',
      MDC_OIDC_REDIRECT_URI: '',
      MDC_OIDC_POST_LOGOUT_REDIRECT_URI: '',
      MDC_DATASET_REGISTRY_URL: 'http://registry.example',
      MDC_DATASET_REGISTRY_TOKEN: 'registry-token-at-least-16',
      MDC_MARQUEZ_URL: '',
    })
    expect(env.MDC_OIDC_ISSUER_URL).toBeUndefined()
    expect(env.MDC_OIDC_CLIENT_ID).toBeUndefined()
    expect(env.MDC_OIDC_CLIENT_SECRET).toBeUndefined()
    expect(env.MDC_OIDC_REDIRECT_URI).toBeUndefined()
    expect(env.MDC_OIDC_POST_LOGOUT_REDIRECT_URI).toBeUndefined()
    expect(env.MDC_MARQUEZ_URL).toBeUndefined()
    expect(env.MDC_DATASET_REGISTRY_URL).toBe('http://registry.example')
  })

  it('OIDC利用時はgroup allowlistを必須にする', () => {
    expect(() => loadEnv({
      MDC_AUTH_MODE: 'oidc',
      MDC_DATABASE_URL_RW: 'postgres://x',
      MDC_DATABASE_URL_RO: 'postgres://x',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@localhost/dashboard',
      MDC_STORAGE_SECRET_KEY: '0'.repeat(64),
      MDC_WEB_ORIGIN: 'https://mado.example',
    })).toThrow(/MDC_OIDC_ALLOWED_GROUPS/)
  })
})

describe('loadLineageEnv', () => {
  it('公開processに必要な最小設定だけを返す', () => {
    const env = loadLineageEnv({
      MDC_DATABASE_URL_RW: 'postgres://mado_lineage@postgres/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://mado_lineage@postgres/dashboard',
      MDC_DATASET_REGISTRY_URL: 'http://registry-api:8080',
      MDC_DATASET_REGISTRY_TOKEN: 'registry-token-at-least-16',
      MDC_OIDC_CLIENT_SECRET: 'must-not-be-parsed',
      MDC_STORAGE_SECRET_KEY: VALID_KEY,
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@postgres/dashboard',
    })
    expect(env.MDC_LINEAGE_PORT).toBe(3001)
    expect(env).not.toHaveProperty('MDC_OIDC_CLIENT_SECRET')
    expect(env).not.toHaveProperty('MDC_STORAGE_SECRET_KEY')
    expect(env).not.toHaveProperty('MDC_DATABASE_URL_MIGRATE')
  })

  it('Registry URLとtokenを必須にする', () => {
    expect(() => loadLineageEnv({
      MDC_DATABASE_URL_RW: 'postgres://mado_lineage@postgres/dashboard',
      MDC_DATABASE_URL_RO: 'postgres://mado_lineage@postgres/dashboard',
    })).toThrow(/DATASET_REGISTRY/)
  })
})

describe('workerの環境設定', () => {
  const required = {
    MDC_ENV: 'production', MDC_DATABASE_URL_RW: 'postgres://mado_worker@postgres/dashboard',
    MDC_DATABASE_URL_RO: 'postgres://mado_worker@postgres/dashboard', MDC_STORAGE_SECRET_KEY: VALID_KEY,
  }

  it('本番でもブラウザ認証の設定を要求せず、APIの秘密を設定に含めない', () => {
    const env = loadWorkerEnv({ ...required, MDC_OIDC_CLIENT_SECRET: 'api-secret', MDC_DATASET_REGISTRY_TOKEN: 'api-token',
      MDC_DATABASE_URL_MIGRATE: 'postgres://postgres@postgres/dashboard' })
    expect(env.MDC_ENV).toBe('production')
    expect(env.MDC_MEDIA_WORKER_PORT).toBe(3100)
    expect(env).not.toHaveProperty('MDC_OIDC_CLIENT_SECRET')
    expect(env).not.toHaveProperty('MDC_DATASET_REGISTRY_TOKEN')
    expect(env).not.toHaveProperty('MDC_DATABASE_URL_MIGRATE')
    expect(env).not.toHaveProperty('MDC_AUTH_MODE')
  })

  it('暗号化キーやDBの接続先が欠けていれば起動を拒否する', () => {
    expect(() => loadWorkerEnv({ ...required, MDC_STORAGE_SECRET_KEY: '' })).toThrow(/MDC_STORAGE_SECRET_KEY/)
    expect(() => loadWorkerEnv({ ...required, MDC_DATABASE_URL_RW: '' })).toThrow(/MDC_DATABASE_URL_RW/)
  })
})

describe('旧名の環境変数', () => {
  it('3つの読み込みとも、旧名だけが残っていれば新名を示して止める', () => {
    const leftover = { DATABASE_URL_RW: 'postgres://old@localhost/dashboard' }
    for (const load of [loadEnv, loadWorkerEnv, loadLineageEnv]) {
      expect(() => load(leftover)).toThrow('DATABASE_URL_RW was replaced by MDC_DATABASE_URL_RW')
    }
  })
})
