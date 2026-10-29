import type { TournamentStatus } from './tournament.types'
import type { EntryStatus, PaymentStatus } from './entry.types'
import type { KnockoutType } from '../utils/knockout'

/**
 * Área do jogador (SPEC-20261029-1726): espelha os DTOs do `MePlayerController` (`GET me/player`, `GET me/tournaments`,
 * `GET me/tournaments/{id}`). Tudo é da própria conta (inscrições cujo jogador está vinculado a ela — SPEC-20261029-1725);
 * do torneio, só as contagens.
 */

/** Onde a conta joga (filtro de /meus-torneios) */
export interface MePlayerHomeGame {
  id: string
  /** Nome do clube; no Mesa "Torneios de <organizador>" (ou "Seus torneios") */
  label: string
  tournamentCount: number
}

/**
 * Um torneio da conta. Com reentrada, as inscrições dela no mesmo torneio viram uma linha (somas; status, posição e mesa
 * da mais recente). Sem Payments no plano do organizador, devido/pago/saldo vêm null; sem Prizes, o prêmio.
 */
export interface MyTournament {
  tournamentId: string
  name: string
  date: string
  status: TournamentStatus
  homeGameId: string
  homeGameLabel: string
  knockoutType: KnockoutType
  totalEntries: number
  playersRemaining: number
  currentLevel: number | null
  isTimerRunning: boolean
  showsPayments: boolean
  showsPrizes: boolean
  entryCount: number
  entryStatus: EntryStatus
  finalPosition: number | null
  rebuyCount: number
  addonCount: number
  totalDue: number | null
  totalPaid: number | null
  balance: number | null
  paymentStatus: PaymentStatus | null
  prizeAmount: number | null
  /** Só no torneio com bounty */
  bountyWon: number | null
}

/** Resposta crua do relógio (`TimerStateResponse`): o `useBlindTimer` normaliza */
export interface MyTimerState {
  currentLevel: number | null
  smallBlind: number
  bigBlind: number
  ante: number
  durationMinutes: number
  elapsedSeconds: number
  remainingSeconds: number
  isRunning: boolean
  isBreak: boolean
  isLastLevel: boolean
  nextLevel: { levelNumber: number; smallBlind: number; bigBlind: number; ante: number; isBreak: boolean } | null
}

export interface MyBlindLevel {
  levelNumber: number
  smallBlind: number
  bigBlind: number
  ante: number
  durationMinutes: number
  isBreak: boolean
}

/** `GET me/tournaments/{id}`: o torneio ao vivo para quem joga (404 sem inscrição da conta) */
export interface MyTournamentLive extends MyTournament {
  /** Null quando o torneio não tem estrutura de blinds */
  timer: MyTimerState | null
  blindLevels: MyBlindLevel[]
  /** Premiação total (só com Prizes) */
  prizePool: number | null
  /** PIX do torneio (só com Payments) */
  pixKey: string | null
  showsTables: boolean
  tableNumber: number | null
  tableName: string | null
  seatNumber: number | null
  bountyHead: number | null
  eliminatedAt: string | null
}

/** `GET me/player`: o resumo de quem joga (Início) */
export interface MePlayerSummary {
  /** E-mail da conta (a dica de cadastrar o e-mail com o organizador) */
  email: string
  tournamentCount: number
  wins: number
  inTheMoney: number
  /** Soma do que deve (só torneios de organizador com controle de pagamentos) */
  openBalance: number
  openBalanceCount: number
  homeGames: MePlayerHomeGame[]
  /** Os 5 mais recentes */
  recent: MyTournament[]
  /** Iniciados em que a conta está inscrita */
  live: MyTournament[]
}
