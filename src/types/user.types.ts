import type { PlanName, PlanSource } from './plan.types'

export type UserRole = 'Admin' | 'TournamentDirector' | 'Dealer' | 'Player'

/** Usuário da sessão (UserResponse). Usado pelo AuthContext: não mudar o shape. */
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

/** PUT admin/users/{id}/plan (só Admin) → AdminUserDetail */
export interface ChangePlanRequest {
  plan: PlanName
  /** ISO; ausente/null = sem vencimento (se vier, no futuro) */
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

/**
 * PUT admin/users/{id} (só Admin): campo ausente = não mexe; apelido/WhatsApp vazios apagam. Sem senha (a senha
 * tem o modal "Redefinir senha") e sem criar conta (D14: toda conta nasce pelo cadastro da própria pessoa).
 */
export interface UpdateUserRequest {
  fullName?: string
  nickname?: string
  email?: string
  whatsapp?: string
  role?: UserRole
}

// ---------------------------------------------------------------- Administração (SPEC-20261023-1206)

/** Filtros da listagem (também guardados na URL: ?q=&plan=&status=&requested=&page=). */
export type AdminUserStatusFilter = 'all' | 'active' | 'inactive'

export interface AdminUserListParams {
  search?: string
  page?: number
  pageSize?: number
  plan?: PlanName
  status?: AdminUserStatusFilter
  /** Só quem pediu plano nas boas-vindas e ainda não foi atendido */
  requested?: boolean
}

/** Linha de GET admin/users */
export interface AdminUserListItem {
  id: string
  fullName: string
  nickname: string | null
  email: string
  photoUrl: string | null
  role: UserRole
  isActive: boolean
  /** Conta excluída pela própria pessoa (não volta a ser ativada) */
  isDeleted: boolean
  /** Falso = conta só-social (entra pelo Google) */
  hasPassword: boolean
  emailConfirmedAt: string | null
  /** Ainda não passou pelas boas-vindas */
  needsOnboarding: boolean
  plan: PlanName
  effectivePlan: PlanName
  planExpiresAt: string | null
  planSource: PlanSource
  planNote: string | null
  requestedPlan: PlanName | null
  requestedPlanAt: string | null
  planRequestPending: boolean
  lastLoginAt: string | null
  lastSeenAt: string | null
  createdAt: string
  ownedHomeGamesCount: number
}

export interface UserPlan {
  plan: PlanName
  effectivePlan: PlanName
  expiresAt: string | null
  source: PlanSource
  note: string | null
  updatedAt: string | null
  updatedBy: string | null
  updatedByName: string | null
}

/** Histórico do plano (audit_logs): troca (`PlanChange`) ou pedido nas boas-vindas (`PlanRequested`). */
export interface UserPlanHistoryEntry {
  id: string
  action: 'PlanChange' | 'PlanRequested' | string
  createdAt: string
  actorId: string | null
  /** "migration" na cortesia dos fundadores */
  actorName: string | null
  fromPlan: string | null
  toPlan: string | null
  fromSource: string | null
  toSource: string | null
  fromExpiresAt: string | null
  toExpiresAt: string | null
  fromNote: string | null
  toNote: string | null
  requestedPlan: string | null
  via: string | null
}

/** Ação administrativa (audit_logs), valores como foram gravados */
export interface UserAuditEntry {
  id: string
  action: string
  createdAt: string
  actorId: string | null
  actorName: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  changedFields: string[] | null
}

export interface AdminUserExternalLogin {
  /** "Google" */
  provider: string
  email: string | null
  connectedAt: string
  lastUsedAt: string | null
}

export interface AdminUserSession {
  id: string
  label: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
}

export interface AdminUserOwnedHomeGame {
  id: string
  name: string
  tournamentsCount: number
  membersCount: number
}

export interface AdminUserMembership {
  homeGameId: string
  name: string
  isAdmin: boolean
  ownerName: string | null
}

/** GET admin/users/{id}: a ficha */
export interface AdminUserDetail {
  id: string
  fullName: string
  nickname: string | null
  email: string
  whatsapp: string | null
  photoUrl: string | null
  role: UserRole
  isActive: boolean
  isDeleted: boolean
  createdAt: string
  emailConfirmedAt: string | null
  hasPassword: boolean
  externalLogins: AdminUserExternalLogin[]
  /** O servidor envia e-mail de verdade? Falso = só senha temporária e link */
  emailDeliveryEnabled: boolean
  onboardedAt: string | null
  needsOnboarding: boolean
  requestedPlan: PlanName | null
  requestedPlanAt: string | null
  planRequestPending: boolean
  lastLoginAt: string | null
  lastSeenAt: string | null
  activeSessions: number
  sessions: AdminUserSession[]
  ownedHomeGames: AdminUserOwnedHomeGame[]
  memberships: AdminUserMembership[]
  plan: UserPlan
  planHistory: UserPlanHistoryEntry[]
  adminActions: UserAuditEntry[]
}

export type AdminResetPasswordMode = 'Temporary' | 'Email' | 'Link'

/** POST admin/users/{id}/password */
export interface AdminResetPasswordRequest {
  mode: AdminResetPasswordMode
  /** Só no modo Temporary (mín. 6) */
  password?: string
}

export interface AdminResetPasswordResponse {
  mode: AdminResetPasswordMode
  /** Modo Email: e-mail mascarado */
  sentTo: string | null
  /** Modo Link: {site}/redefinir-senha/{token} */
  resetUrl: string | null
  expiresAt: string | null
  /** Modo Link: WhatsApp da conta (55 + DDD + número, só dígitos) ou null */
  whatsapp: string | null
}

/** POST admin/users/{id}/confirmation-email */
export interface AdminEmailSentResponse {
  sentTo: string
}
