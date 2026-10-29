/**
 * Área do jogador (SPEC-20261029-1726): `GET me/player`, `GET me/tournaments` e `GET me/tournaments/{id}`. Só a própria
 * conta, sem escopo de home game; token de dealer não acessa (403).
 */
import apiClient from './client'
import type { PaginatedResponse } from '../types/common.types'
import type { MePlayerSummary, MyTournament, MyTournamentLive } from '../types/mePlayer.types'

export const ME_PLAYER_QUERY_KEY = ['me', 'player'] as const
export const MY_TOURNAMENTS_QUERY_KEY = ['me', 'tournaments'] as const

export async function getSummary(): Promise<MePlayerSummary> {
  const response = await apiClient.get<MePlayerSummary>('/me/player')
  return response.data
}

export interface MyTournamentsParams {
  homeGameId?: string | null
  page?: number
  pageSize?: number
}

export async function getMyTournaments({ homeGameId, page = 1, pageSize = 20 }: MyTournamentsParams = {}): Promise<
  PaginatedResponse<MyTournament>
> {
  const response = await apiClient.get<PaginatedResponse<MyTournament>>('/me/tournaments', {
    params: { homeGameId: homeGameId || undefined, page, pageSize },
  })
  return response.data
}

export async function getMyTournament(tournamentId: string): Promise<MyTournamentLive> {
  const response = await apiClient.get<MyTournamentLive>(`/me/tournaments/${tournamentId}`)
  return response.data
}
