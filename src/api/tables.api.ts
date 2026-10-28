import apiClient from './client'

export interface Table {
  id: string
  tournamentId?: string
  tableNumber: number
  tableName?: string
  maxSeats: number
  isFinalTable?: boolean
  dealerPersonId?: string | null
  dealerName?: string | null
  playerCount?: number
  players?: TablePlayer[]
}

export interface TablePlayer {
  id: string
  seatNumber: number
  personId: string
  name: string
  photo: string | null
}

export async function getAll(tournamentId: string): Promise<Table[]> {
  const response = await apiClient.get<Table[]>(
    `/tournaments/${tournamentId}/tables`,
  )
  return response.data
}

export async function create(
  tournamentId: string,
  data: { tableNumber: number; maxSeats: number },
): Promise<Table> {
  const response = await apiClient.post<Table>(
    `/tournaments/${tournamentId}/tables`,
    data,
  )
  return response.data
}

export async function draw(
  tournamentId: string,
  data?: { tableCount?: number; maxSeatsPerTable?: number },
): Promise<Table[]> {
  const response = await apiClient.post<Table[]>(
    `/tournaments/${tournamentId}/tables/draw`,
    data ?? {},
  )
  return response.data
}


export async function movePlayer(
  tournamentId: string,
  data: {
    entryId: string
    toTableId: string
    toSeat: number
    /** 'balance' = movido pelo aviso de mesas desequilibradas (aparece no histórico) */
    reason?: 'balance'
    /**
     * Arrastar até um lugar vazio (SPEC-20261027-2133): se alguém sentou nele nesse meio-tempo, o servidor recusa (400)
     * em vez de trocar com quem chegou. Sem o campo, lugar ocupado troca os dois (o "Mover jogador" de sempre).
     */
    requireFreeSeat?: boolean
  },
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/tables/move`,
    data,
  )
}

export interface SwapPlayersResult {
  /** "Fulano e Beltrano trocaram de lugar." */
  message: string
  entry: { id: string; name: string; tableId: string; tableName: string; seatNumber: number }
  other: { id: string; name: string; tableId: string; tableName: string; seatNumber: number }
}

/**
 * Troca dois jogadores sentados de lugar numa operação só (SPEC-20261027-2133: soltar um jogador no lugar de outro).
 * `from`/`to` = onde o painel via cada um ao soltar: se um deles mudou de lugar nesse meio-tempo, 400 sem mexer em ninguém.
 */
export async function swapPlayers(
  tournamentId: string,
  data: {
    entryId: string
    otherEntryId: string
    fromTableId?: string
    fromSeat?: number
    toTableId?: string
    toSeat?: number
  },
): Promise<SwapPlayersResult> {
  const response = await apiClient.post<SwapPlayersResult>(`/tournaments/${tournamentId}/tables/swap`, data)
  return response.data
}

/**
 * Exclui uma mesa sem ninguém sentado (SPEC-20261027-2133). Com jogador sentado o servidor recusa com 400 e a mensagem
 * em pt-BR; o dealer da mesa fica livre e a mesa some do painel, do telão e do terminal.
 */
export async function remove(tournamentId: string, tableId: string): Promise<void> {
  await apiClient.delete(`/tournaments/${tournamentId}/tables/${tableId}`)
}

/** Evento SignalR `TablesUpdate` (TablesController, depois do commit de toda mudança de mesa/lugar) */
export interface TablesUpdateEvent {
  tournamentId: string
  action: 'created' | 'drawn' | 'balanced' | 'moved' | 'swapped' | 'broken' | 'unseated' | 'dealer' | 'deleted'
  tableId: string | null
  tableName: string | null
}

export async function unseatPlayer(
  tournamentId: string,
  entryId: string,
): Promise<void> {
  await apiClient.post(`/tournaments/${tournamentId}/tables/unseat`, { entryId })
}

export interface BreakTableMove {
  entryId: string
  playerName: string
  toTableId: string
  toTableName: string
  toSeat: number
}

export interface BreakTableResult {
  brokenTableName: string
  moves: BreakTableMove[]
  /** Sobrou 1 mesa: ela virou a mesa final */
  finalTable: boolean
}

/** Quebra a mesa: sorteia os jogadores dela nos lugares livres das outras */
export async function breakTable(
  tournamentId: string,
  tableId: string,
): Promise<BreakTableResult> {
  const response = await apiClient.post<BreakTableResult>(
    `/tournaments/${tournamentId}/tables/${tableId}/break`,
  )
  return response.data
}
