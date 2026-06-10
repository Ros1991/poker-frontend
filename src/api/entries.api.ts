import apiClient from './client'
import type {
  TournamentEntry,
  CreateEntryRequest,
  EliminateRequest,
} from '../types/entry.types'

const base = (tournamentId: string) =>
  `/tournaments/${tournamentId}/Entries`

export async function getAll(
  tournamentId: string,
): Promise<TournamentEntry[]> {
  const response = await apiClient.get<TournamentEntry[]>(base(tournamentId))
  return response.data
}

export async function create(
  tournamentId: string,
  data: CreateEntryRequest,
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    base(tournamentId),
    data,
  )
  return response.data
}

export async function rebuy(
  tournamentId: string,
  entryId: string,
  data?: { quantity?: number },
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/rebuy`,
    data ?? { quantity: 1 },
  )
  return response.data
}

export async function addon(
  tournamentId: string,
  entryId: string,
  data?: { isDouble?: boolean },
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/addon`,
    data ?? {},
  )
  return response.data
}

export async function eliminate(
  tournamentId: string,
  entryId: string,
  data?: EliminateRequest,
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/eliminate`,
    data,
  )
  return response.data
}

export async function remove(
  tournamentId: string,
  entryId: string,
): Promise<void> {
  await apiClient.delete(`${base(tournamentId)}/${entryId}`)
}

export async function removeRebuy(
  tournamentId: string,
  entryId: string,
): Promise<TournamentEntry> {
  const response = await apiClient.delete<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/rebuy`,
  )
  return response.data
}

export async function removeAddon(
  tournamentId: string,
  entryId: string,
): Promise<TournamentEntry> {
  const response = await apiClient.delete<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/addon`,
  )
  return response.data
}

export async function undoElimination(
  tournamentId: string,
  entryId: string,
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/undo-elimination`,
  )
  return response.data
}
