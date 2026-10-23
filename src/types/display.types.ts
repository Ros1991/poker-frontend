// TV pareada por QR e terminal do dealer por QR (espelham os DTOs do backend)

import type { PlanName } from './plan.types'

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
  // SPEC-20261023-1205 (D6/D13). No Mesa o backend já devolve prizes = [], prizePool = 0, tables = [],
  // responsiblePixKey = null e zera balance/totalDue/prizeAmount de cada entrada.
  /** Plano efetivo do dono do home game */
  plan?: PlanName
  /** Mesa e Clube mostram o selo "Feito com Poker da Galera" (Mesa com QR, Clube discreto) */
  showBadge?: boolean
  /** Só na Liga: logo do clube (HomeGame.LogoUrl) no lugar do selo */
  clubLogoUrl?: string | null
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

// ---- QR do dealer (SPEC-20261023-1208: o QR não dá acesso sozinho) ----

/** QR ativo do torneio (DealerAccessResponse). O código vai no QR; o dealer pede acesso e espera. */
export interface DealerAccess {
  id: string
  code: string
  expiresAt: string
  createdAt: string
  /** Pedidos aguardando autorização (não vencidos) */
  pendingCount: number
  /** Dealers conectados: aprovados no prazo e com o QR não revogado */
  approvedCount: number
}

export type DealerRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Revoked'

/** Resposta do POST dealer-access/requests (aparelho do dealer, anônimo) */
export interface DealerRequestCreated {
  requestId: string
  /** "Approved" quando o mesmo aparelho já tem pedido aprovado válido neste torneio (reabrir o terminal) */
  status: 'Pending' | 'Approved'
  tournamentName: string
}

/** Resposta do GET dealer-access/requests/{id}?deviceKey= (consulta a cada 3 s) */
export interface DealerRequestPoll {
  requestId: string
  status: DealerRequestStatus
  /** Nome normalizado */
  name: string
  tournamentId: string
  tournamentName: string
  /** Pedido venceu sem decisão (15 min) ou a aprovação já passou do prazo */
  expired: boolean
  /** Só quando Approved, no prazo, deviceKey confere, QR não revogado e torneio não encerrado */
  accessToken: string | null
  /** Só quando Approved (prazo do token) */
  expiresAt: string | null
}

/** Pedido na lista do organizador (DealerRequestResponse): pendentes primeiro, depois os conectados */
export interface DealerRequest {
  id: string
  name: string
  status: DealerRequestStatus
  requestedAt: string
  decidedAt: string | null
  /** Só quando Approved */
  expiresAt: string | null
  /** Último acesso do terminal (granularidade de 30 s) */
  lastSeenAt: string | null
  userAgent: string | null
}

/** GET tournaments/{id}/dealer-access/session (token do dealer) */
export interface DealerSessionInfo {
  requestId: string
  tournamentId: string
  tournamentName: string
  dealerName: string
  expiresAt: string
}
