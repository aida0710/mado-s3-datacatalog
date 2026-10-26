import type { AuthContextValue } from './auth-context'

export const AUTH_FIXTURE: AuthContextValue = {
  user: {
    id: '0b6c1a52-7d4e-4f3a-9c2b-8e1f5a6d7c30', username: 'tanaka', email: null, displayName: '田中', signatureName: 'tanaka',
    roles: ['admin'], permissions: ['connections:manage'], mustChangePassword: false, authMethods: ['local'],
  },
  logout: async () => {},
  reload: async () => {},
}
