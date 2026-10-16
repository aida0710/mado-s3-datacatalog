import type { AuthContextValue } from './auth-context'

export const AUTH_FIXTURE: AuthContextValue = {
  user: {
    id: 'user-1', username: 'tanaka', email: null, displayName: '田中', signatureName: 'tanaka',
    roles: ['admin'], permissions: ['connections:manage'], mustChangePassword: false, authMethods: ['local'],
  },
  logout: async () => {},
  reload: async () => {},
}
