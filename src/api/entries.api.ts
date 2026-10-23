import apiClient from './client'
import type {
  TournamentEntry,
  CreateEntryRequest,
  EliminateRequest,
  AvailablePlayer,
  QuickAddEntryRequest,
  QuickAddEntryResponse,
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

export async function bulkCreate(
  tournamentId: string,
  personIds: string[],
  buyInPaid: boolean,
): Promise<TournamentEntry[]> {
  const response = await apiClient.post<TournamentEntry[]>(
    `${base(tournamentId)}/bulk`,
    { personIds, buyInPaid },
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
  // O backend só lê eliminatedByEntryId (e notes); entryId vai na rota
  data?: Partial<EliminateRequest>,
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

/** Jogadores do home game que ainda não estão no torneio (terminal: só nome e apelido) */
export async function getAvailablePlayers(
  tournamentId: string,
): Promise<AvailablePlayer[]> {
  const response = await apiClient.get<AvailablePlayer[]>(
    `${base(tournamentId)}/available-players`,
  )
  return response.data
}

/** Inscrição rápida pelo terminal; se já houver mesas, o servidor senta o jogador sozinho */
export async function quickAdd(
  tournamentId: string,
  data: QuickAddEntryRequest,
): Promise<QuickAddEntryResponse> {
  const response = await apiClient.post<QuickAddEntryResponse>(
    `${base(tournamentId)}/quick-add`,
    { buyInPaid: false, ...data },
  )
  return response.data
}
