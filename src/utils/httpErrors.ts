import axios from 'axios'

/** Verdadeiro quando o erro de uma query/mutation é um 403 da API (sem acesso ao home game). */
export function isForbiddenError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403
}

/** Status HTTP do erro de uma chamada à API, ou undefined se não for erro de resposta. */
export function errorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined
}
