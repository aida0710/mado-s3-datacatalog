import type { AccessToken, AccessTokenInput, AccessTokenScope } from '../types/accessTokens'

export function localDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function accessTokenFormInput(input: {
  name: string
  description: string
  scopes: AccessTokenScope[]
  namespaces: string
  expiry: string
  previous: AccessToken | null
}): AccessTokenInput {
  const includesLineage = input.scopes.some(scope => scope.startsWith('lineage:'))
  const sameExpiry = input.previous !== null && input.expiry === localDateTimeInput(input.previous.expiresAt)
  return {
    name: input.name.trim(), description: input.description.trim(), scopes: input.scopes,
    namespaces: includesLineage ? [...new Set(input.namespaces.split(',').map(name => name.trim()).filter(Boolean))] : [],
    ...(sameExpiry ? {} : { expiresAt: input.expiry ? new Date(input.expiry).toISOString() : null }),
  }
}
