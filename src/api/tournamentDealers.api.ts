import apiClient from './client'

export interface TournamentDealer {
  id: string
  personId: string
  name: string
  nickname: string | null
  photoUrl: string | null
  whatsapp: string | null
  assignedAt: string
}

export async function getAll(tournamentId: string): Promise<TournamentDealer[]> {
  const response = await apiClient.get<TournamentDealer[]>(`/tournaments/${tournamentId}/dealers`)
  return response.data
}

export async function add(tournamentId: string, personId: string): Promise<{ id: string; personId: string }> {
  const response = await apiClient.post<{ id: string; personId: string }>(`/tournaments/${tournamentId}/dealers`, { personId })
  return response.data
}

export async function remove(tournamentId: string, dealerId: string): Promise<void> {
  await apiClient.delete(`/tournaments/${tournamentId}/dealers/${dealerId}`)
}
