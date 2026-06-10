import apiClient from './client'
import type { PaginatedResponse } from '../types/common.types'
import type {
  Tournament,
  CreateTournamentRequest,
} from '../types/tournament.types'

export async function getAll(
  homeGameId: string,
  params?: { page?: number; pageSize?: number; search?: string },
): Promise<PaginatedResponse<Tournament>> {
  const response = await apiClient.get<PaginatedResponse<Tournament>>(
    `/home-games/${homeGameId}/Tournaments`,
    { params },
  )
  return response.data
}

export async function getById(id: string): Promise<Tournament> {
  const response = await apiClient.get<Tournament>(`/tournaments/${id}`)
  return response.data
}

export async function create(
  homeGameId: string,
  data: CreateTournamentRequest,
): Promise<Tournament> {
  const response = await apiClient.post<Tournament>(
    `/home-games/${homeGameId}/Tournaments`,
    data,
  )
  return response.data
}

export async function update(
  homeGameId: string,
  id: string,
  data: CreateTournamentRequest,
): Promise<Tournament> {
  const response = await apiClient.put<Tournament>(
    `/home-games/${homeGameId}/Tournaments/${id}`,
    data,
  )
  return response.data
}

export async function updateStatus(
  homeGameId: string,
  id: string,
  status: string,
): Promise<Tournament> {
  const response = await apiClient.patch<Tournament>(
    `/home-games/${homeGameId}/Tournaments/${id}/status`,
    { status },
  )
  return response.data
}

export async function remove(homeGameId: string, id: string): Promise<void> {
  await apiClient.delete(`/home-games/${homeGameId}/Tournaments/${id}`)
}
