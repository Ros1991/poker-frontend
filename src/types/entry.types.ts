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
  /** Knockout (SPEC-20261026-1909): o que está na cabeça do jogador agora (0 depois de eliminado e no Normal) */
  bountyHead: number
  /** Knockout: dinheiro de bounty que o jogador já ganhou eliminando os outros */
  bountyWon: number
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
  /** Knockout: a cabeça do eliminado, o que foi em dinheiro para quem eliminou e (PKO) o que somou na cabeça dele */
  bountyAmount?: number | null
  bountyCash?: number | null
  bountyToHead?: number | null
  /** A eliminação deixou só o campeão: o torneio se finalizou sozinho (revisão geral 2) */
  tournamentFinished?: boolean
  /** Apelido (ou nome) do campeão, quando o torneio se finalizou nesta eliminação */
  championName?: string | null
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

