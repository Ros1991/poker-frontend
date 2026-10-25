import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import type {
  AuthUser,
  ExternalLoginRequest,
  ExternalProviderName,
  LoginRequest,
} from '../types/auth.types'
import * as authApi from '../api/auth.api'
import { setTokens, clearTokens, hasStoredSession, SESSION_ENDED_EVENT } from '../api/client'
// O contexto mora em authContextValue.ts: este arquivo só exporta o componente (react-refresh)
import { AuthContext } from './authContextValue'
import type { AuthContextValue } from './authContextValue'

interface AuthProviderProps {
  children: ReactNode
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)

  const isAuthenticated = user !== null

  useEffect(() => {
    let cancelled = false

    // Só desloga quando o servidor recusa a sessão. Sem conexão (redeploy, wifi
    // ruim) continua tentando, sem mandar para o login nem apagar a sessão.
    async function loadUser() {
      if (!hasStoredSession()) {
        setUser(null)
        setIsLoading(false)
        return
      }
      for (let attempt = 0; !cancelled; attempt++) {
        try {
          const me = await authApi.getMe()
          if (!cancelled) setUser(me)
          break
        } catch (err) {
          if (cancelled) return
          const status = axios.isAxiosError(err) ? err.response?.status : undefined
          if (status === 401 || status === 404 || !hasStoredSession()) {
            clearTokens()
            setUser(null)
            break
          }
          if (attempt >= 1) setIsReconnecting(true)
          await sleep(Math.min(1500 * (attempt + 1), 10000))
        }
      }
      if (!cancelled) {
        setIsReconnecting(false)
        setIsLoading(false)
      }
    }

    void loadUser()

    return () => {
      cancelled = true
    }
  }, [sessionVersion])

  // Login/logout em outra aba: acompanha sem recarregar
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key !== 'poker_refresh_token' && e.key !== null) return
      if (!hasStoredSession()) setUser(null)
      else setSessionVersion((v) => v + 1)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // O servidor recusou a renovação nesta aba (o client já limpou os tokens)
  useEffect(() => {
    function handleSessionEnded() {
      setUser(null)
    }
    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded)
  }, [])

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data)
    setTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }, [])

  // Login com Google (SPEC-20261023-1210): mesma sessão por aparelho do login por senha
  const loginWithExternal = useCallback(
    async (provider: ExternalProviderName, data: ExternalLoginRequest) => {
      const response = await authApi.externalLogin(provider, data)
      setTokens(response.accessToken, response.refreshToken)
      setUser(response.user)
    },
    [],
  )

  // Confirmação de e-mail com a senha do cadastro (SPEC-20261023-1209, D16.10): mesma sessão do login
  const confirmEmail = useCallback(async (token: string, password: string) => {
    const response = await authApi.confirmEmail(token, password)
    setTokens(response.accessToken, response.refreshToken)
    setUser(response.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  // Meu perfil (SPEC-20261023-1211): nome/foto salvos aparecem no cabeçalho na hora
  const updateUser = useCallback((patch: Partial<Pick<AuthUser, 'name' | 'photoUrl'>>) => {
    setUser((current) => (current ? { ...current, ...patch } : current))
  }, [])

  // Conta excluída: o servidor já derrubou todas as sessões; só limpa este aparelho
  const clearSession = useCallback(() => {
    clearTokens()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      isReconnecting,
      login,
      loginWithExternal,
      confirmEmail,
      logout,
      updateUser,
      clearSession,
    }),
    [user, isAuthenticated, isLoading, isReconnecting, login, loginWithExternal, confirmEmail, logout, updateUser, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
