import type { PlanName } from './plan.types'
import type { PixKeyType } from '../utils/pix'
import type { KnockoutType } from '../utils/knockout'

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
  rebuyStack: number | null
  addonStack: number | null
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
  /** Bounties comprados (inscrições + rebuys), à parte do prize pool — netPrizePool já vem sem eles (SPEC-20261026-1909) */
  totalBounties: number
  /** Formato (SPEC-20261026-1909): 'None' = Normal, 'Simple' = Knockout simples, 'Progressive' = PKO */
  knockoutType: KnockoutType
  /** Parte do buy-in (e de cada rebuy) que vira bounty; null no Normal */
  bountyAmount: number | null
  prizeConfirmed: boolean
  settlementClosed: boolean
  blindStructureId: string | null
  seatsPerTable: number
  responsiblePixKey: string | null
  staffAmount: number | null
  rankingContribMode: string | null
  rankingContribValue: number | null
  rankingPrizeAccrued: number | null
  punctualityBonusCount: number | null
  punctualityBonusChips: number | null
  createdAt: string
  updatedAt: string
  // SPEC-20261023-1205: plano efetivo do DONO do home game do torneio.
  ownerPlan?: PlanName
  /** Recursos exclusivos liberados — use `hasFeature(tournament.planFeatures, 'Tables')` */
  planFeatures?: string[]
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
  rebuyStack?: number
  addonStack?: number
  maxRebuys: number
  addonAllowed: boolean
  addonDoubleAllowed?: boolean
  blindStructureId?: string
  seatsPerTable?: number
  responsiblePixKey?: string | null
  /** Tipo escolhido da chave do dia (SPEC-20261023-1218); null = a API detecta */
  responsiblePixKeyType?: PixKeyType | null
  staffAmount?: number
  rankingContribMode?: 'PerPlayer' | 'Percent'
  rankingContribValue?: number
  /**
   * Quantos dealers trabalham no torneio quando a estrutura tem dealer pago (0–20; ausente = 1). Vira o custo
   * "Dealers (N × R$ X)" na criação (e na primeira estrutura de um rascunho) — SPEC-20261023-1215.
   */
  dealerCount?: number
  /** Formato knockout (SPEC-20261026-1909); na criação, ausente = herdar o padrão da estrutura */
  knockoutType?: KnockoutType
  /** Valor do bounty (parte do buy-in); null/ausente no Normal */
  bountyAmount?: number | null
}

export interface UpdateTournamentRequest extends Partial<CreateTournamentRequest> {
  id: string
}

export interface UpdateTournamentStatusRequest {
  id: string
  status: TournamentStatus
}
