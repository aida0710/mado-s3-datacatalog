import { describe, expect, it } from 'vitest'
import { assertNoRenamedEnvironmentVariables, RENAMED_ENVIRONMENT_VARIABLES } from './renamed-environment-variables.js'

describe('assertNoRenamedEnvironmentVariables', () => {
  it('旧名だけが設定されていれば、残っている旧名をすべて新名と並べて止める', () => {
    expect(() => assertNoRenamedEnvironmentVariables({ ENCRYPTION_KEY: 'x', ALLOWED_ORIGINS: 'http://a' }))
      .toThrow(/ENCRYPTION_KEY was replaced by MDC_STORAGE_SECRET_KEY; ALLOWED_ORIGINS was replaced by MDC_WEB_ORIGIN/)
  })

  it('空の値でも旧名の名前があれば止める', () => {
    expect(() => assertNoRenamedEnvironmentVariables({ OIDC_CLIENT_SECRET: '' }))
      .toThrow('OIDC_CLIENT_SECRET was replaced by MDC_OIDC_CLIENT_SECRET')
  })

  it('エラーに旧名の値を出さない', () => {
    const secret = 'old-secret-value-must-not-appear'
    expect(() => assertNoRenamedEnvironmentVariables({ DASHBOARD_PASSWORD: secret }))
      .toThrow(expect.objectContaining({ message: expect.not.stringContaining(secret) }))
  })

  it('新名があれば、旧名が残っていても止めない', () => {
    expect(() => assertNoRenamedEnvironmentVariables({ AUTH_MODE: 'local', MDC_AUTH_MODE: 'local' })).not.toThrow()
  })

  it('旧名が無ければ止めない', () => {
    expect(() => assertNoRenamedEnvironmentVariables({ MDC_AUTH_MODE: 'local', POSTGRES_PASSWORD: 'x' })).not.toThrow()
  })

  it('新名はどれもMDC_で始まり、同じ新名を2つの旧名に割り当てない', () => {
    const newNames = Object.values(RENAMED_ENVIRONMENT_VARIABLES)
    expect(newNames.every(name => name.startsWith('MDC_'))).toBe(true)
    expect(new Set(newNames).size).toBe(newNames.length)
  })
})
