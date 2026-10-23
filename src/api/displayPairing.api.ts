import apiClient from './client'
import type {
  DisplayPaired,
  PairableTournament,
  PairingCodeLookup,
} from '../types/display.types'

// Lado do celular logado no pareamento da TV

export async function lookupCode(code: string): Promise<PairingCodeLookup> {
  const response = await apiClient.get<PairingCodeLookup>(
    `/display/pair/${encodeURIComponent(code)}`,
  )
  return response.data
}

export async function getMyTournaments(): Promise<PairableTournament[]> {
  const response = await apiClient.get<PairableTournament[]>('/display/my-tournaments')
  return response.data
}

export async function claim(tournamentId: string, code: string): Promise<DisplayPaired> {
  const response = await apiClient.post<DisplayPaired>(
    `/tournaments/${tournamentId}/display-sessions/claim`,
    { code },
  )
  return response.data
}

/** Botão "TV Display" do painel: este navegador vira a TV do torneio. */
export async function pairThisBrowser(tournamentId: string): Promise<string> {
  const response = await apiClient.post<{ deviceToken: string }>(
    `/tournaments/${tournamentId}/display-sessions`,
  )
  return response.data.deviceToken
}
