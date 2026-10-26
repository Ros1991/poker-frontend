import type { Person } from './person.types'

export type EntryStatus = 'Registered' | 'Active' | 'Eliminated' | 'Awarded' | 'PaidOut'

export type PaymentStatus = 'Pending' | 'PartiallyPaid' | 'Paid' | 'Overpaid'

export interface TournamentEntry {
  id: string
  tournamentId: string
  personId: string
  person: Person
  tableId: string | null
  seatNumber: number | null
  status: EntryStatus
  /** Legado (SPEC-20261023-1213, F15): sempre false em inscrição nova — o pagamento vem da tela de pagamentos */
  buyInPaid: boolean
  buyInAmount: number
  rebuyCount: number
  rebuyTotal: number
  addonPurchased: boolean
  addonDouble: boolean
  addonAmount: number
  totalDue: number
  totalPaid: number
  balance: number
  paymentStatus: PaymentStatus
  finalPosition: number | null
  eliminatedAt: string | null
  /** Inscrição de quem eliminou este jogador (null = não informado, ainda jogando ou eliminação desfeita) */
  eliminatedById: string | null
  /**
   * Quantas pessoas este jogador eliminou neste torneio (SPEC-20261026-1908). Só a lista (GET entries) preenche; as
   * respostas de uma inscrição só (rebuy, add-on, pagamento) vêm com 0.
   */
  eliminationsCount: number
  prizeAmount: number
  prizePaid: boolean
  rankingPoints: number
  createdAt: string
}

/** Inscrição individual: nasce sempre Pendente (sem "buy-in pago") */
export interface CreateEntryRequest {
  personId: string
}

export interface RebuyRequest {
  entryId: string
  paid?: boolean
}

export interface AddonRequest {
  entryId: string
  paid?: boolean
}

export interface EliminateRequest {
  entryId: string
  position?: number
  eliminatedByEntryId?: string
}

/** Resultado de POST .../eliminate */
export interface EliminationResult {
  position: number
  playerName: string
  eliminatedBy: string | null
  playersRemaining: number
  isInTheMoney: boolean
  whatsAppLink: string | null
}

/** Mesa aberta pela inscrição (SPEC-20261023-1214) */
export interface SeatingOpenedTable {
  tableId: string
  tableName: string
}

/** Onde cada um sentou */
export interface SeatingSeat {
  entryId: string
  playerName: string
  tableId: string
  tableName: string
  seatNumber: number
}

/** Quem já estava sentado e mudou para a mesa aberta agora ("Ana: Mesa 1, lugar 3 → Mesa 2, lugar 5") */
export interface SeatingMove {
  entryId: string
  playerName: string
  fromTableId: string
  fromTableName: string
  fromSeat: number | null
  toTableId: string
  toTableName: string
  toSeat: number
}

/** Resultado do assento da inscrição (espelha SeatingResultResponse do backend) */
export interface SeatingResult {
  /** Plano do dono com mesas: sem ele ninguém senta e o resultado não fala de mesa */
  tablesEnabled: boolean
  /** Torneio já começou (late registration): mudar de lugar entre uma mão e outra */
  inProgress: boolean
  openedTables: SeatingOpenedTable[]
  /** Os inscritos agora (e, na primeira mesa, quem já estava inscrito sem lugar) */
  seated: SeatingSeat[]
  moves: SeatingMove[]
  /** Texto pronto, ex.: "Mesa 2 aberta: 4 jogadores movidos" */
  summary: string | null
}

/** Resposta de POST .../entries/bulk */
export interface BulkCreateEntriesResult {
  entries: TournamentEntry[]
  seating: SeatingResult
}

/** Jogador do home game que ainda não está no torneio (só id, nome, apelido e foto — sem contato) */
export interface AvailablePlayer {
  id: string
  fullName: string
  nickname: string | null
  photoUrl: string | null
}

