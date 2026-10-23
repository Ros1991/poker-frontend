import type { PlanName, PlanSource } from './plan.types'

export type UserRole = 'Admin' | 'TournamentDirector' | 'Dealer' | 'Player'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  photoUrl: string | null
  // Plano da conta (SPEC-20261023-1205; UserResponse). Opcionais para não quebrar telas existentes.
  plan?: PlanName
  effectivePlan?: PlanName
  planExpiresAt?: string | null
  planSource?: PlanSource
  planNote?: string | null
}

/** PUT api/v1/users/{id}/plan (só Admin) → User */
export interface ChangePlanRequest {
  plan: PlanName
  /** ISO; ausente/null = sem vencimento */
  expiresAt?: string | null
  source: PlanSource
  note?: string | null
}

/** Resultado de GET /Users/lookup?email= (busca por e-mail exato): nunca traz o papel. */
export interface UserLookup {
  id: string
  name: string
  email: string
  photoUrl: string | null
}

export interface CreateUserRequest {
  fullName: string
  nickname?: string
  email: string
  whatsapp?: string
  password: string
  role: UserRole
}

export interface UpdateUserRequest {
  fullName?: string
  nickname?: string
  email?: string
  whatsapp?: string
  password?: string
  role?: UserRole
  isActive?: boolean
}
