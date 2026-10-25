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
  eliminatedByPersonId: string | null
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

/** Jogador do home game que ainda não está no torneio (só id, nome, apelido e foto — sem contato) */
export interface AvailablePlayer {
  id: string
  fullName: string
  nickname: string | null
  photoUrl: string | null
}

