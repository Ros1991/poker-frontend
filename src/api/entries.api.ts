import apiClient from './client'
import type {
  TournamentEntry,
  CreateEntryRequest,
  EliminateRequest,
  AvailablePlayer,
  BulkCreateEntriesResult,
  AddonRequest,
  TimebankResult,
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

/**
 * Inscrição em lote — a única rota do painel e do terminal (SPEC-20261023-1213, F13; liberada ao dealer).
 * Toda inscrição nasce Pendente: o pagamento é registrado depois, na tela de pagamentos (sem "buy-in pago").
 * O servidor já senta quem entrou (SPEC-20261023-1214): abre mesa e equilibra quando enche; `seating` diz onde
 * cada um sentou e quem mudou de lugar.
 */
export async function bulkCreate(
  tournamentId: string,
  personIds: string[],
): Promise<BulkCreateEntriesResult> {
  const response = await apiClient.post<BulkCreateEntriesResult>(
    `${base(tournamentId)}/bulk`,
    { personIds },
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

/** Add-on (SPEC-20261027-1311): `quantity` add-ons de uma vez (1 a 10), até o máximo do torneio (400 acima dele) */
export async function addon(
  tournamentId: string,
  entryId: string,
  data?: AddonRequest,
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/addon`,
    data ?? { quantity: 1 },
  )
  return response.data
}

/**
 * Timebank (SPEC-20261029-1722): registra o uso (tira 1). `actionId` é gerado no celular para este uso: o "Tentar de novo"
 * manda o mesmo e o servidor não desconta duas vezes. A contagem do tempo é local (não espera esta resposta).
 */
export async function useTimebank(
  tournamentId: string,
  entryId: string,
  actionId: string,
): Promise<TimebankResult> {
  const response = await apiClient.post<TimebankResult>(`${base(tournamentId)}/${entryId}/timebank/use`, { actionId })
  return response.data
}

/** Timebank (SPEC-20261029-1722): dá (+1) ou tira (−1) um timebank do jogador; nunca abaixo de 0 */
export async function adjustTimebank(
  tournamentId: string,
  entryId: string,
  delta: 1 | -1,
): Promise<TimebankResult> {
  const response = await apiClient.post<TimebankResult>(`${base(tournamentId)}/${entryId}/timebank/adjust`, { delta })
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

// SPEC-20261023-1217 (L17): as funções que desfaziam "o último" rebuy/add-on (DELETE entries/{id}/rebuy|addon, sem
// confirmação nem rastro) saíram: tudo que se desfaz passa pelo histórico (history.api.ts), amarrado ao item exato.

export async function undoElimination(
  tournamentId: string,
  entryId: string,
): Promise<TournamentEntry> {
  const response = await apiClient.post<TournamentEntry>(
    `${base(tournamentId)}/${entryId}/undo-elimination`,
  )
  return response.data
}

/** Jogadores do home game que ainda não estão no torneio (só id, nome, apelido e foto; o dealer também usa) */
export async function getAvailablePlayers(
  tournamentId: string,
): Promise<AvailablePlayer[]> {
  const response = await apiClient.get<AvailablePlayer[]>(
    `${base(tournamentId)}/available-players`,
  )
  return response.data
}

