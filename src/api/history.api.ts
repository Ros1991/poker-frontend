import apiClient from './client'
import type { HistoryItem } from '../types/history.types'

const base = (tournamentId: string) => `/tournaments/${tournamentId}/history`

/** Histórico do torneio (ou só de um jogador), do mais recente para o mais antigo */
export async function getHistory(
  tournamentId: string,
  entryId?: string,
): Promise<HistoryItem[]> {
  const response = await apiClient.get<HistoryItem[]>(base(tournamentId), {
    params: entryId ? { entryId } : undefined,
  })
  return response.data
}

/** Desfaz inscrição, rebuy, add-on, pagamento ou abatimento */
export async function undoTransaction(
  tournamentId: string,
  transactionId: string,
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `${base(tournamentId)}/transactions/${transactionId}/undo`,
  )
  return response.data
}

export async function undoElimination(
  tournamentId: string,
  eliminationId: string,
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `${base(tournamentId)}/eliminations/${eliminationId}/undo`,
  )
  return response.data
}
