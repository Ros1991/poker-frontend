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

/**
 * Os mesmos níveis pela rota direta do torneio (SPEC-20261029-1721): sem o homeGameId na URL, aceita também o token do
 * dealer por QR (o telão no celular calcula o "Próximo intervalo" com eles).
 */
export async function getAllDirect(tournamentId: string): Promise<TournamentBlindLevel[]> {
  const response = await apiClient.get<TournamentBlindLevel[]>(`/tournaments/${tournamentId}/blind-levels`)
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
