// "Meu perfil" (SPEC-20261023-1211): espelho dos DTOs de me/* (ProfileRequests.cs / ProfileResponses.cs).
import type { PlanName } from './plan.types'
import type { ExternalProviderName } from './auth.types'

/** `GET/PUT me`, `POST/DELETE me/photo`. */
export interface Profile {
  id: string
  email: string
  /** Nome da conta (é o `name` do usuário da sessão) */
  fullName: string
  nickname: string | null
  /** 55 + DDD + número, só dígitos (ou o valor antigo até a pessoa salvar) */
  whatsapp: string | null
  photoUrl: string | null
  role: string
  /** Falso = a conta só entra pelo Google (pode definir senha pelo link) */
  hasPassword: boolean
  /** E-mail de retransmissão da Apple: o perfil oferece "Copiar" */
  emailIsPrivateRelay: boolean
  emailConfirmedAt: string | null
  createdAt: string
  lastLoginAt: string | null
  /** Home games dos quais a conta é dona (com algum, excluir a conta fica bloqueado) */
  ownedHomeGames: number
  effectivePlan: PlanName
}

export interface UpdateProfileRequest {
  fullName: string
  nickname?: string | null
  /** Com ou sem 55/máscara; o servidor grava 55 + DDD + número. Vazio = sem WhatsApp */
  whatsapp?: string | null
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  message: string
  otherSessionsRevoked: number
}

export interface PasswordSetupLinkResponse {
  message: string
  /** Para onde foi o link, mascarado ("ro***@gmail.com") */
  email: string
}

export interface ExternalLoginAccount {
  email: string | null
  connectedAt: string
  lastUsedAt: string | null
}

export interface ExternalLoginItem {
  provider: ExternalProviderName
  displayName: string
  /** Ligado no servidor (dá para conectar agora) */
  enabled: boolean
  clientId: string | null
  connected: boolean
  accounts: ExternalLoginAccount[]
  /** Falso = é a única forma de entrar: desconectar é bloqueado */
  canDisconnect: boolean
}

/** `GET me/logins` (e a resposta de conectar/desconectar). */
export interface ExternalLogins {
  hasPassword: boolean
  providers: ExternalLoginItem[]
}

export interface ConnectExternalLoginRequest {
  idToken: string
  nonce: string
}

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

/** `GET me/sessions`: um aparelho conectado. */
export interface DeviceSession {
  id: string
  /** "Chrome no Windows", "Safari no iPhone"… */
  label: string
  browser: string
  platform: string
  deviceType: DeviceType
  createdAt: string
  lastUsedAt: string | null
  /** É este aparelho */
  current: boolean
}

/**
 * `DELETE me`: "EXCLUIR" + a senha (conta com senha) ou, sem senha, o ID token de um login com o Google feito agora
 * (com o nonce que a API emitiu para o botão).
 */
export interface DeleteAccountRequest {
  confirmation: string
  password?: string
  idToken?: string
  nonce?: string
}

/** Texto que a pessoa digita para confirmar a exclusão. */
export const DELETE_CONFIRMATION_WORD = 'EXCLUIR'
