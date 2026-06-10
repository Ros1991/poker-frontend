export type TournamentStatus =
  | 'Draft'
  | 'OpenForRegistration'
  | 'InProgress'
  | 'BreakSettlement'
  | 'Finished'
  | 'Cancelled'

export interface Tournament {
  id: string
  homeGameId: string
  homeGameName: string
  rankingId: string | null
  rankingName: string | null
  name: string
  status: TournamentStatus
  date: string
  buyInAmount: number
  rebuyAmount: number
  addonAmount: number
  startingStack: number
  maxRebuys: number
  addonAllowed: boolean
  addonDoubleAllowed: boolean
  currentLevel: number
  isTimerRunning: boolean
  totalEntries: number
  totalRebuys: number
  totalAddons: number
  playersRemaining: number
  totalPrizePool: number
  totalCosts: number
  netPrizePool: number
  prizeConfirmed: boolean
  settlementClosed: boolean
  blindStructureId: string | null
  seatsPerTable: number
  responsiblePixKey: string | null
  staffAmount: number | null
  rankingContribMode: string | null
  rankingContribValue: number | null
  rankingPrizeAccrued: number | null
  createdAt: string
  updatedAt: string
}

export interface CreateTournamentRequest {
  homeGameId: string
  rankingId?: string
  name: string
  date: string
  buyInAmount: number
  rebuyAmount: number
  addonAmount: number
  startingStack: number
  maxRebuys: number
  addonAllowed: boolean
  addonDoubleAllowed?: boolean
  blindStructureId?: string
  seatsPerTable?: number
  responsiblePixKey?: string
  staffAmount?: number
  rankingContribMode?: 'PerPlayer' | 'Percent'
  rankingContribValue?: number
}

export interface UpdateTournamentRequest extends Partial<CreateTournamentRequest> {
  id: string
}

export interface UpdateTournamentStatusRequest {
  id: string
  status: TournamentStatus
}
