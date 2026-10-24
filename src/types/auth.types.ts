import type { PlanName, PlanSource } from './plan.types'

export interface LoginRequest {
  email: string
  password: string
  /**
   * Ticket do 409 `link_requires_password` do login com Google (SPEC-20261023-1210): com a senha certa
   * da conta, conecta o Google a ela e entra. Ausente = login de sempre.
   */
  linkTicket?: string
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

// ---- Login com Google (SPEC-20261023-1210) ----

/** Provedor de login social (segmento de `POST auth/external/{provider}`). Só o Google está ligado hoje. */
export type ExternalProviderName = 'google' | 'apple'

export interface ExternalProviderInfo {
  provider: ExternalProviderName
  /** Client ID público que o botão oficial usa */
  clientId: string
}

/** `GET auth/external/providers`: só os provedores ligados no servidor. */
export interface ExternalProvidersResponse {
  providers: ExternalProviderInfo[]
}

/** `POST auth/external/nonce`: nonce de uso único (10 min) para o próximo clique no botão. */
export interface ExternalNonceResponse {
  nonce: string
  expiresIn: number
}

export interface ExternalLoginRequest {
  /** ID token (JWT) que o botão do Google devolveu */
  idToken: string
  /** O nonce passado ao botão antes do clique */
  nonce: string
  /** Ticket de um 409 anterior que a pessoa abandonou: o servidor descarta */
  linkTicket?: string
}

/** 409 do login social: a conta existe e está confirmada; a senha dela conclui o vínculo. */
export interface ExternalLinkRequired {
  ticket: string
  /** E-mail da conta (o mesmo da conta Google) */
  email: string
  message: string
}

/** Código do 409 de `POST auth/external/{provider}`. */
export const LINK_REQUIRES_PASSWORD_CODE = 'link_requires_password'

/** Código do 403 de login social em conta desativada. */
export const ACCOUNT_DISABLED_CODE = 'account_disabled'

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
