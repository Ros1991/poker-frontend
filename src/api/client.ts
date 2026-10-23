import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '../types/common.types'
import type {
  PlanFeature,
  PlanLimitCode,
  PlanLimitDetail,
  PlanLimitError,
  PlanName,
} from '../types/plan.types'

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

// ---- Limite de plano (SPEC-20261023-1205) ----
// Toda recusa de plano é HTTP 402 com o corpo de PlanLimitError. O interceptor abaixo dispara
// PLAN_LIMIT_EVENT com o corpo em `detail` (o UpgradeModal único, montado no AppLayout, escuta) e
// a promessa CONTINUA rejeitando, para o chamador encerrar o loading. Para não mostrar toast de
// erro junto do modal, o chamador testa `isPlanLimitError(err)` no onError.

/** Evento da janela com `detail: PlanLimitDetail`; o UpgradeModal escuta. */
export const PLAN_LIMIT_EVENT = 'poker:plan-limit'

const PLAN_LIMIT_CODES: readonly string[] = [
  'feature_locked',
  'home_games_limit',
  'tournaments_per_week',
  'members_limit',
]

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Lê o corpo de um 402 de plano; null quando não é (sem `code` conhecido). */
export function parsePlanLimitBody(data: unknown): PlanLimitError | null {
  if (!data || typeof data !== 'object') return null
  const body = data as Record<string, unknown>
  const code = str(body.code)
  if (!code || !PLAN_LIMIT_CODES.includes(code)) return null
  return {
    status: 402,
    error: 'PaymentRequired',
    code: code as PlanLimitCode,
    feature: str(body.feature) as PlanFeature | null,
    currentPlan: (str(body.currentPlan) ?? 'Mesa') as PlanName,
    requiredPlan: (str(body.requiredPlan) ?? 'Clube') as PlanName,
    usage: num(body.usage),
    limit: num(body.limit),
    nextAllowedAt: str(body.nextAllowedAt),
    message: str(body.message) ?? 'Recurso disponível em um plano pago.',
    timestamp: str(body.timestamp) ?? new Date().toISOString(),
  }
}

/** Corpo do 402 de plano a partir do erro de uma chamada (axios), ou null. */
export function planLimitFromError(error: unknown): PlanLimitError | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 402) return null
  return parsePlanLimitBody(error.response.data)
}

/** Verdadeiro quando o erro é um 402 de plano (o UpgradeModal já abriu: não mostre toast). */
export function isPlanLimitError(error: unknown): boolean {
  return planLimitFromError(error) !== null
}

/** Abre o UpgradeModal (mesmo caminho do 402). Prefira `usePlanGate().open(detail)` nas telas. */
export function notifyPlanLimit(detail: PlanLimitDetail) {
  window.dispatchEvent(new CustomEvent<PlanLimitDetail>(PLAN_LIMIT_EVENT, { detail }))
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

    // Limite de plano: abre o modal de upgrade e a promessa segue rejeitando
    if (error.response?.status === 402) {
      const detail = parsePlanLimitBody(error.response.data)
      if (detail) notifyPlanLimit(detail)
      return Promise.reject(error)
    }

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
