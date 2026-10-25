import apiClient from './client'
import type { AvailablePlayer } from '../types/entry.types'

// Jogadores pelo torneio (SPEC-20261023-1213): cadastrar jogador novo e pôr/trocar a foto, no painel e no terminal
// do dealer (a rota começa com /tournaments/{id}, então no modo dealer vai com o token do QR).

const base = (tournamentId: string) => `/tournaments/${tournamentId}/players`

export interface CreateTournamentPlayerRequest {
  fullName: string
  nickname?: string
  whatsapp?: string
}

/** Cadastra no home game do torneio (não inscreve: a inscrição é pelo lote) */
export async function create(tournamentId: string, data: CreateTournamentPlayerRequest): Promise<AvailablePlayer> {
  const response = await apiClient.post<AvailablePlayer>(base(tournamentId), data)
  return response.data
}

/** Foto já recortada (JPEG 512 × 512). Dealer: só de quem está no torneio ou ainda não tem foto */
export async function uploadPhoto(tournamentId: string, personId: string, photo: Blob): Promise<AvailablePlayer> {
  const formData = new FormData()
  formData.append('file', photo, 'foto.jpg')
  const response = await apiClient.post<AvailablePlayer>(`${base(tournamentId)}/${personId}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}
