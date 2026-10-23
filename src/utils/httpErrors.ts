import axios from 'axios'
import type { ApiErrorBody } from '../types/auth.types'

/** Verdadeiro quando o erro de uma query/mutation é um 403 da API (sem acesso ao home game). */
export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403
}

/** Status HTTP do erro de uma chamada à API, ou undefined se não for erro de resposta. */
export function errorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}

/**
 * Corpo `{ code?, message }` do erro de uma chamada à API (ErrorHandlingMiddleware, JSON em
 * camelCase). Campos ausentes, vazios ou de outro tipo voltam como undefined.
 */
export function errorBody(error: unknown): Partial<ApiErrorBody> | undefined {
  if (!axios.isAxiosError(error)) return undefined
  const data: unknown = error.response?.data
  if (!data || typeof data !== 'object') return undefined
  const { code, message } = data as Record<string, unknown>
  return {
    code: typeof code === 'string' && code ? code : undefined,
    message: typeof message === 'string' && message.trim() ? message : undefined,
  }
}

/** Mensagem que o backend mandou no erro, se houver. */
export function errorMessage(error: unknown): string | undefined {
  return errorBody(error)?.message
}

/** Código específico do erro (ex.: `email_not_confirmed`), se o backend mandou. */
export function errorCode(error: unknown): string | undefined {
  return errorBody(error)?.code
}
