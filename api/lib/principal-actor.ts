import type { RequestPrincipal } from './auth-types.js'
import type { AuditActor } from './audit.js'

export function principalActor(principal: RequestPrincipal): AuditActor {
  return principal.kind === 'user' ? { type: 'user', userId: principal.user.id }
    : { type: 'service_account', serviceAccountId: principal.serviceAccountId, keyId: principal.keyId }
}

export function principalUserId(principal: RequestPrincipal | null): string | null {
  return principal?.kind === 'user' ? principal.user.id : null
}

export function principalEditor(principal: RequestPrincipal | null): string | null {
  if (!principal) return null
  return principal.kind === 'user' ? principal.user.signatureName : principal.tokenName
}

export function principalRegistryId(principal: RequestPrincipal): string {
  return principal.kind === 'user' ? principal.user.id : principal.serviceAccountId
}
