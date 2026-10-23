import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '../types/common.types'

const ACCESS_KEY = 'poker_access_token'
const REFRESH_KEY = 'poker_refresh_token'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Sessão do usuário: o refresh vale 90 dias por aparelho e NÃO muda ao renovar.
// O localStorage é a fonte da verdade (compartilhado entre abas); a memória é só cache.
let accessToken: string | null = readStorage(ACCESS_KEY)
let refreshPromise: Promise<string> | null = null

export function setTokens(access: string, refresh: string) {
  accessToken = access
  localStorage.setItem(ACCESS_KEY, access)
  localStorage.setItem(REFRESH_KEY, refresh)
}

export function getAccessToken() {
  return dealerScope?.token ?? accessToken
}

export function hasStoredSession() {
  return !!readStorage(REFRESH_KEY) || !!readStorage(ACCESS_KEY)
}

export function clearTokens() {
  accessToken = null
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

/** Disparado quando o servidor recusa a sessão (o AuthContext desloga esta aba) */
export const SESSION_ENDED_EVENT = 'poker:session-ended'

// O 'storage' não dispara na própria aba: sem isto a UI ficaria "logada" com tudo dando 401
function endSession() {
  clearTokens()
  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT))
}

// Outra aba renovou, entrou ou saiu: acompanha sem precisar recarregar
window.addEventListener('storage', (e) => {
  if (e.key === ACCESS_KEY || e.key === null) accessToken = readStorage(ACCESS_KEY)
})

// ---- Modo dealer (QR) ----
// O terminal aberto pelo QR usa um token próprio, restrito ao torneio. Só as
// chamadas desse torneio levam esse token; o resto (ex.: /auth/me) segue com a
// sessão do usuário, se houver — um admin que teste no próprio celular não cai.
let dealerScope: { token: string; tournamentId: string } | null = null
let dealerExpiredHandler: (() => void) | null = null

export function setDealerScope(scope: { token: string; tournamentId: string } | null) {
  dealerScope = scope
}

export function setDealerExpiredHandler(handler: (() => void) | null) {
  dealerExpiredHandler = handler
}

function isDealerRequest(url: string | undefined) {
  return !!dealerScope && !!url && url.startsWith(`/tournaments/${dealerScope.tournamentId}`)
}

// Endpoints de autenticação não disparam renovação (401 no login é senha errada)
function isAuthEndpoint(url: string | undefined) {
  return !!url && /\/auth\/(login|register|refresh)$/.test(url)
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('poker-auth-refresh', fn) as Promise<T>
  }
  return fn()
}

/**
 * Renova o access token. Só desloga quando o servidor responde que a sessão
 * não vale mais (401/400); queda de rede, timeout ou 5xx mantêm a sessão.
 */
function refreshAccessToken(failedToken: string | null): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = withRefreshLock(async () => {
      // Outra aba pode ter renovado enquanto esperávamos a trava
      const stored = readStorage(ACCESS_KEY)
      if (stored && stored !== failedToken) {
        accessToken = stored
        return stored
      }

      const refresh = readStorage(REFRESH_KEY)
      if (!refresh) {
        endSession()
        throw new Error('Sem sessão')
      }

      try {
        const response = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${baseURL}/auth/refresh`,
          { refreshToken: refresh },
          { timeout: 15000 },
        )
        setTokens(response.data.accessToken, response.data.refreshToken || refresh)
        return response.data.accessToken
      } catch (err) {
        const status = axios.isAxiosError(err) ? err.response?.status : undefined
        if ((status === 401 || status === 400) && readStorage(REFRESH_KEY) === refresh) {
          endSession()
        }
        throw err
      }
    }).finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

const apiClient = axios.create({
  baseURL,
  // Timeout para a requisição não ficar pendurada pra sempre (ex.: durante um
  // redeploy do backend). Sem isso, o axios espera indefinidamente.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean; _dealer?: boolean }

apiClient.interceptors.request.use((config: RetriableConfig) => {
  if (isDealerRequest(config.url)) {
    config.headers.Authorization = `Bearer ${dealerScope!.token}`
    config._dealer = true
  } else if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as RetriableConfig | undefined

    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error)
    }

    // QR do dealer revogado/expirado ou torneio encerrado: não há renovação
    if (originalRequest._dealer) {
      dealerExpiredHandler?.()
      return Promise.reject(error)
    }

    if (originalRequest._retry || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error)
    }
    originalRequest._retry = true

    const sentHeader = originalRequest.headers.Authorization
    const failedToken =
      typeof sentHeader === 'string' ? sentHeader.replace(/^Bearer /, '') : null

    let newAccess: string
    try {
      newAccess = await refreshAccessToken(failedToken)
    } catch (refreshError) {
      // Sessão recusada (tokens já limpos) → devolve o 401 original;
      // rede/timeout/5xx → devolve o erro da renovação e a sessão fica
      return Promise.reject(hasStoredSession() ? refreshError : error)
    }
    originalRequest.headers.Authorization = `Bearer ${newAccess}`
    return apiClient(originalRequest)
  },
)

export default apiClient
