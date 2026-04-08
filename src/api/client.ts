import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { ApiError } from '../types/common.types'

let accessToken: string | null = localStorage.getItem('poker_access_token')
let refreshTokenValue: string | null = localStorage.getItem('poker_refresh_token')
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

export function setTokens(access: string, refresh: string) {
  accessToken = access
  refreshTokenValue = refresh
  localStorage.setItem('poker_access_token', access)
  localStorage.setItem('poker_refresh_token', refresh)
}

export function getAccessToken() {
  return accessToken
}

export function clearTokens() {
  accessToken = null
  refreshTokenValue = null
  localStorage.removeItem('poker_access_token')
  localStorage.removeItem('poker_refresh_token')
}

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(apiClient(originalRequest))
            },
            reject,
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        if (!refreshTokenValue) {
          // Sem refresh token — não tentar refresh, apenas rejeitar
          clearTokens()
          return Promise.reject(error)
        }

        const response = await axios.post<{
          accessToken: string
          refreshToken: string
        }>(`${apiClient.defaults.baseURL}/auth/refresh`, {
          refreshToken: refreshTokenValue,
        })

        const { accessToken: newAccess, refreshToken: newRefresh } =
          response.data
        setTokens(newAccess, newRefresh)
        processQueue(null, newAccess)

        originalRequest.headers.Authorization = `Bearer ${newAccess}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        clearTokens()
        // Não fazer hard redirect — deixar o React Router lidar
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
