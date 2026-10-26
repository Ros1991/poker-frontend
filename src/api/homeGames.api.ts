import apiClient from './client'
import type {
  HomeGame,
  HomeGameDeletionSummary,
  HomeGameMember,
  AddMemberRequest,
  CreateHomeGameRequest,
  UpdateHomeGameRequest,
} from '../types/homeGame.types'

export async function getAll(): Promise<HomeGame[]> {
  const response = await apiClient.get<HomeGame[]>('/HomeGames')
  return response.data
}

export async function getById(id: string): Promise<HomeGame> {
  const response = await apiClient.get<HomeGame>(`/HomeGames/${id}`)
  return response.data
}

export async function create(data: CreateHomeGameRequest): Promise<HomeGame> {
  const response = await apiClient.post<HomeGame>('/HomeGames', data)
  return response.data
}

export async function update(
  id: string,
  data: UpdateHomeGameRequest,
): Promise<HomeGame> {
  const response = await apiClient.put<HomeGame>(`/HomeGames/${id}`, data)
  return response.data
}

/** O que some junto com o home game (dono ou Admin do sistema; SPEC-20261026-1126). */
export async function getDeletionSummary(id: string): Promise<HomeGameDeletionSummary> {
  const response = await apiClient.get<HomeGameDeletionSummary>(`/HomeGames/${id}/deletion-summary`)
  return response.data
}

/**
 * Exclui o home game em cascata (dono ou Admin do sistema). O servidor confere de novo o nome digitado: vazio ou
 * diferente → 400; torneio em andamento → 400 com a mensagem; 204 excluído.
 */
export async function remove(id: string, confirmName: string): Promise<void> {
  await apiClient.delete(`/HomeGames/${id}`, { data: { confirmName } })
}

export async function getMembers(id: string): Promise<HomeGameMember[]> {
  const response = await apiClient.get<HomeGameMember[]>(
    `/HomeGames/${id}/members`,
  )
  return response.data
}

export async function addMember(
  id: string,
  data: AddMemberRequest,
): Promise<HomeGameMember> {
  const response = await apiClient.post<HomeGameMember>(
    `/HomeGames/${id}/members`,
    data,
  )
  return response.data
}

export async function updateMember(
  homeGameId: string,
  memberId: string,
  data: { isAdmin?: boolean; personId?: string | null },
): Promise<HomeGameMember> {
  const response = await apiClient.put<HomeGameMember>(
    `/HomeGames/${homeGameId}/members/${memberId}`,
    data,
  )
  return response.data
}

export async function removeMember(
  homeGameId: string,
  memberId: string,
): Promise<void> {
  await apiClient.delete(`/HomeGames/${homeGameId}/members/${memberId}`)
}
