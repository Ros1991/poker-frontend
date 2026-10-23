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

export interface CreateEntryRequest {
  tournamentId: string
  personId: string
  paid?: boolean
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

/** Jogador do home game que ainda não está no torneio (só nome e apelido) */
export interface AvailablePlayer {
  id: string
  fullName: string
  nickname: string | null
  photoUrl: string | null
}

/** Cadastro rápido do terminal: pessoa existente (personId) ou nova (fullName/nickname) */
export interface QuickAddEntryRequest {
  personId?: string
  fullName?: string
  nickname?: string
  buyInPaid?: boolean
}

export interface QuickAddEntryResponse {
  entry: TournamentEntry
  tableId: string | null
  tableName: string | null
  seatNumber: number | null
}
