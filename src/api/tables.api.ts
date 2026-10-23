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

export async function setDealer(
  tournamentId: string,
  tableId: string,
  dealerPersonId: string | null,
): Promise<void> {
  await apiClient.put(
    `/tournaments/${tournamentId}/tables/${tableId}/dealer`,
    { dealerPersonId },
  )
}

export async function movePlayer(
  tournamentId: string,
  data: {
    entryId: string
    toTableId: string
    toSeat: number
    /** 'balance' = movido pelo aviso de mesas desequilibradas (aparece no histórico) */
    reason?: 'balance'
  },
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/tables/move`,
    data,
  )
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
