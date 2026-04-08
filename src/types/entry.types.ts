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
  eliminatedByPersonId?: string
}
