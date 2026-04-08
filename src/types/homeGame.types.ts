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
  pixKey?: string
  pixBeneficiary?: string
  timezone?: string
  defaultBuyIn?: number
  defaultRebuy?: number
  defaultAddon?: number
}

export interface UpdateHomeGameRequest extends Partial<CreateHomeGameRequest> {}
