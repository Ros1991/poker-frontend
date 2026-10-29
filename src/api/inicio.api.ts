/**
 * Início da conta (SPEC-20261029-1724): `GET me/inicio` — plano, torneios acontecendo agora e os torneios de cada home
 * game que a conta acessa, numa consulta só. Token de dealer não acessa (403).
 */
import apiClient from './client'
import type { Inicio } from '../types/inicio.types'

export const INICIO_QUERY_KEY = ['me', 'inicio'] as const

export async function getInicio(): Promise<Inicio> {
  const response = await apiClient.get<Inicio>('/me/inicio')
  return response.data
}
