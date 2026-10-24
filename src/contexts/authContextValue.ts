import { createContext } from 'react'
import type { AuthUser, ExternalLoginRequest, ExternalProviderName, LoginRequest } from '../types/auth.types'

// Contexto da sessão, separado do AuthProvider (AuthContext.tsx) para o arquivo do provider só
// exportar componente (react-refresh/only-export-components). Leia com `useAuth`.

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Sessão guardada, mas o servidor não responde (redeploy, wifi): tentando de novo */
  isReconnecting: boolean
  /** E-mail e senha (com `linkTicket`, também conecta o Google à conta — SPEC-20261023-1210) */
  login: (data: LoginRequest) => Promise<void>
  /** Entrar com o Google (ID token do botão oficial + nonce emitido pela API) */
  loginWithExternal: (provider: ExternalProviderName, data: ExternalLoginRequest) => Promise<void>
  /** Link do e-mail de confirmação + senha do cadastro (D16.10): confirma e já entra */
  confirmEmail: (token: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
