import { createContext, useContext } from 'react'
import type { z } from 'zod'
import type { AuthUser as AuthUserSchema } from '../../api/shared/schemas/auth'

export type AuthUser = z.infer<typeof AuthUserSchema>

export interface AuthContextValue {
  user: AuthUser | null
  logout(): Promise<void>
  reload(): Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  logout: async () => {},
  reload: async () => {},
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
