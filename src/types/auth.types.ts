import type { PlanName, PlanSource } from './plan.types'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  fullName: string
  nickname?: string
  email: string
  password: string
  whatsapp?: string
}

/** Resposta do cadastro (202): a conta nasce sem sessão até confirmar o e-mail (D16.1). */
export interface RegisterResponse {
  email: string
  message: string
}

export interface ConfirmEmailRequest {
  token: string
}

export interface ResendConfirmationRequest {
  email: string
}

/**
 * Corpo de erro da API. `code` só vem em erros que a tela trata de forma específica
 * (ex.: `email_not_confirmed` no 403 do login).
 */
export interface ApiErrorBody {
  code?: string
  message: string
}

/** Código do 403 do login quando a senha confere mas o e-mail ainda não foi confirmado. */
export const EMAIL_NOT_CONFIRMED_CODE = 'email_not_confirmed'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthUser
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'Admin' | 'TournamentDirector' | 'Dealer' | 'Player'
  photoUrl: string | null
  // Plano da conta (SPEC-20261023-1205). Opcionais para não quebrar quem monta AuthUser à mão.
  /** Plano gravado na conta */
  plan?: PlanName
  /** O que vale agora: `plan` se `planExpiresAt` nulo ou futuro, senão Mesa */
  effectivePlan?: PlanName
  planExpiresAt?: string | null
  planSource?: PlanSource
  /** Ex.: "fundador" */
  planNote?: string | null
}
