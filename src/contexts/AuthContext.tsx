import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import type { AuthUser, LoginRequest } from '../types/auth.types'
import * as authApi from '../api/auth.api'
import { setTokens, clearTokens, hasStoredSession, SESSION_ENDED_EVENT } from '../api/client'

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  /** Sessão guardada, mas o servidor não responde (redeploy, wifi): tentando de novo */
  isReconnecting: boolean
  login: (data: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

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

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      clearTokens()
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      isReconnecting,
      login,
      logout,
    }),
    [user, isAuthenticated, isLoading, isReconnecting, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
