import apiClient from './client'
import type {
  Ranking,
  RankingLeaderboardEntry,
  CreateRankingRequest,
} from '../types/ranking.types'

export async function getAll(homeGameId: string): Promise<Ranking[]> {
  const response = await apiClient.get<Ranking[]>(
    `/home-games/${homeGameId}/rankings`,
  )
  return response.data
}

export async function getById(id: string): Promise<Ranking> {
  const response = await apiClient.get<Ranking>(`/rankings/${id}`)
  return response.data
}

export async function create(
  homeGameId: string,
  data: Omit<CreateRankingRequest, 'homeGameId'>,
): Promise<Ranking> {
  const response = await apiClient.post<Ranking>(
    `/home-games/${homeGameId}/rankings`,
    { ...data, homeGameId },
  )
  return response.data
}

export async function update(
  homeGameId: string,
  rankingId: string,
  data: Partial<CreateRankingRequest> & { accumulatedPrize?: number },
): Promise<unknown> {
  const response = await apiClient.put(
    `/home-games/${homeGameId}/rankings/${rankingId}`,
    data,
  )
  return response.data
}

export async function getLeaderboard(
  id: string,
): Promise<RankingLeaderboardEntry[]> {
  const response = await apiClient.get<RankingLeaderboardEntry[]>(
    `/rankings/${id}/leaderboard`,
  )
  return response.data
}
