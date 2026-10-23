// TV pareada por QR e terminal do dealer por QR (espelham os DTOs do backend)

export interface DisplaySessionStatus {
  status: 'Pending' | 'Paired'
  pairingCode: string | null
  codeExpiresAt: string | null
  tournamentId: string | null
  tournamentName: string | null
}

export interface DisplaySessionCreated {
  deviceToken: string
  session: DisplaySessionStatus
}

export interface PairingCodeLookup {
  valid: boolean
  currentTournamentName: string | null
}

export interface PairableTournament {
  id: string
  name: string
  date: string
  status: string
  homeGameName: string
}

export interface DisplayPaired {
  tournamentId: string
  tournamentName: string
}

export interface TvTournamentInfo {
  id: string
  name: string
  status: string
  prizeConfirmed: boolean
  startingStack: number
  rebuyStack: number | null
  addonStack: number | null
  punctualityBonusCount: number | null
  punctualityBonusChips: number | null
  totalEntries: number
  totalRebuys: number
  totalAddons: number
  responsiblePixKey: string | null
}

export interface TvBlindLevel {
  levelNumber: number
  durationMinutes: number
  isBreak: boolean
}

export interface TvEntry {
  id: string
  personId: string
  displayName: string
  status: string
  finalPosition: number | null
  tableId: string | null
  seatNumber: number | null
  rebuyCount: number
  addonPurchased: boolean
  addonDouble: boolean
  balance: number
  totalDue: number
  prizeAmount: number | null
}

export interface TvTable {
  id: string
  tableNumber: number
  tableName: string | null
  maxSeats: number
  dealerName: string | null
  players: { seatNumber: number | null; personId: string; name: string }[]
}

export interface TvSnapshot {
  tournament: TvTournamentInfo
  timer: unknown
  blindLevels: TvBlindLevel[]
  entries: TvEntry[]
  tables: TvTable[]
  prizes: { position: number; amount: number }[]
  prizePool: number
  generatedAt: string
}

export interface DealerAccess {
  id: string
  code: string
  expiresAt: string
  createdAt: string
  exchangeCount: number
}

export interface DealerExchange {
  accessToken: string
  expiresAt: string
  tournamentId: string
  tournamentName: string
}
