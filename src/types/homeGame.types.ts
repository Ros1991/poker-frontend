import type { PlanName } from './plan.types'
import type { PixKeyType } from '../utils/pix'

export interface HomeGame {
  id: string
  ownerId: string
  name: string
  description: string | null
  location: string | null
  logoUrl: string | null
  pixKey: string | null
  pixBeneficiary: string | null
  timezone: string
  defaultBuyIn: number | null
  defaultRebuy: number | null
  defaultAddon: number | null
  isActive: boolean
  memberCount: number
  tournamentCount: number
  createdAt: string
  // SPEC-20261023-1205: o plano que vale aqui é o do DONO (efetivo), não o de quem está logado.
  /** Plano efetivo do dono do home game */
  ownerPlan?: PlanName
  /** Recursos exclusivos liberados pelo plano do dono — use `hasFeature(homeGame.planFeatures, 'Rankings')` */
  planFeatures?: string[]
}

export interface HomeGameMember {
  id: string
  homeGameId: string
  userId: string
  userName: string
  userEmail: string
  userPhotoUrl: string | null
  personId: string | null
  personName: string | null
  personNickname: string | null
  personPhotoUrl: string | null
  isAdmin: boolean
  joinedAt: string
  isActive: boolean
}

export interface AddMemberRequest {
  userId: string
  personId?: string
  isAdmin: boolean
}

export interface CreateHomeGameRequest {
  name: string
  description?: string
  location?: string
  logoUrl?: string
  pixKey?: string | null
  /** Tipo escolhido da chave (SPEC-20261023-1218); null = a API detecta */
  pixKeyType?: PixKeyType | null
  pixBeneficiary?: string | null
  timezone?: string
  defaultBuyIn?: number | null
  defaultRebuy?: number | null
  defaultAddon?: number | null
}

export type UpdateHomeGameRequest = Partial<CreateHomeGameRequest>

/**
 * GET HomeGames/{id}/deletion-summary (SPEC-20261026-1126): o que some junto com o home game. Só o dono e o Admin do
 * sistema leem. `blockedMessage` preenchido = há torneio em andamento e a exclusão é recusada.
 */
export interface HomeGameDeletionSummary {
  homeGameId: string
  name: string
  ownerId: string
  ownerName: string | null
  tournaments: number
  players: number
  rankings: number
  /** Membros além do dono (perdem o acesso) */
  members: number
  blockingTournamentId: string | null
  blockingTournamentName: string | null
  blockedMessage: string | null
}
