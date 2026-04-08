import apiClient from './client'

export interface TournamentBlindLevel {
  id?: string
  levelNumber: number
  smallBlind: number
  bigBlind: number
  ante: number
  bigBlindAnte: number
  durationMinutes: number
  isBreak: boolean
  breakDescription: string | null
}

export async function getAll(
  homeGameId: string,
  tournamentId: string,
): Promise<TournamentBlindLevel[]> {
  const response = await apiClient.get<TournamentBlindLevel[]>(
    `/home-games/${homeGameId}/tournaments/${tournamentId}/blind-levels`,
  )
  return response.data
}

export async function update(
  homeGameId: string,
  tournamentId: string,
  levels: TournamentBlindLevel[],
): Promise<void> {
  await apiClient.put(
    `/home-games/${homeGameId}/tournaments/${tournamentId}/blind-levels`,
    { levels },
  )
}
