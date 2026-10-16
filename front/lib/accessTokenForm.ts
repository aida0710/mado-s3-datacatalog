import type { AccessToken, AccessTokenInput, InternalApiPermission } from '../types/accessTokens'

export function localDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function accessTokenFormInput(input: {
  name: string
  description: string
  permissions: InternalApiPermission[]
  connections: string[]
  namespaces: string[]
  expiry: string
  previous: AccessToken | null
}): AccessTokenInput {
  const includesLineage = input.permissions.some(permission => permission.startsWith('lineage:'))
  const namespaces = includesLineage ? [...new Set(input.namespaces)] : []
  const sameExpiry = input.previous !== null && input.expiry === localDateTimeInput(input.previous.expiresAt)
  return {
    name: input.name.trim(), description: input.description.trim(),
    permissions: input.permissions,
    connections: input.connections.includes('*') ? ['*'] : input.connections,
    namespaces: namespaces.includes('*') ? ['*'] : namespaces,
    ...(sameExpiry ? {} : { expiresAt: input.expiry ? new Date(input.expiry).toISOString() : null }),
  }
}
