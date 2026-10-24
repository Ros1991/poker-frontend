import axios from 'axios'
import apiClient from './client'
import { LINK_REQUIRES_PASSWORD_CODE } from '../types/auth.types'
import type {
  LoginRequest,
  LoginResponse,
  AuthUser,
  RefreshTokenRequest,
  RegisterRequest,
  RegisterResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ConfirmEmailRequest,
  ConfirmEmailInfo,
  ResendConfirmationRequest,
  ExternalProviderName,
  ExternalProvidersResponse,
  ExternalNonceResponse,
  ExternalLoginRequest,
  ExternalLinkRequired,
} from '../types/auth.types'

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data)
  return response.data
}

/**
 * Cadastro: 202 sem sessão (a conta só entra depois de confirmar o e-mail). Repetir com o e-mail
 * de uma conta ainda não confirmada sobrescreve os dados e reenvia o link; conta confirmada → 400.
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', data)
  return response.data
}

/**
 * Anônimo (D16.10): token do link + a senha do cadastro. 200 = confirmou e já devolve a sessão (mesma resposta do
 * login); 400 "Senha incorreta." (o link continua valendo) ou "Link inválido ou expirado…"; 429 no rate limit ou
 * com senha errada demais (`too_many_attempts`).
 */
export async function confirmEmail(token: string, password: string): Promise<LoginResponse> {
  const body: ConfirmEmailRequest = { token, password }
  const response = await apiClient.post<LoginResponse>('/auth/confirm-email', body)
  return response.data
}

/** Anônimo: e-mail mascarado da conta do link e se ele ainda vale (não consome o link). */
export async function getConfirmEmailInfo(token: string): Promise<ConfirmEmailInfo> {
  const response = await apiClient.get<ConfirmEmailInfo>(
    `/auth/confirm-email/${encodeURIComponent(token)}/info`,
  )
  return response.data
}

/**
 * Anônimo: o backend responde 202 neutro (e-mail inexistente, já confirmado ou em cooldown
 * dão a mesma resposta). Devolve a mensagem do backend.
 */
export async function resendConfirmation(email: string): Promise<string> {
  const body: ResendConfirmationRequest = { email }
  const response = await apiClient.post<{ message?: string }>(
    '/auth/resend-confirmation',
    body,
  )
  return (
    response.data?.message ??
    'Se o e-mail estiver cadastrado e ainda não confirmado, enviamos um novo link.'
  )
}

export async function refreshToken(
  data: RefreshTokenRequest,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/refresh', data)
  return response.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

/** Anônimo: o backend responde 202 neutro, exista o e-mail ou não. */
export async function forgotPassword(data: ForgotPasswordRequest): Promise<void> {
  await apiClient.post('/auth/forgot-password', data)
}

/** Anônimo: 204 em sucesso; 400 com message quando o link não vale mais. */
export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
  await apiClient.post('/auth/reset-password', data)
}

// ---- Login com Google (SPEC-20261023-1210) ----

/** Anônimo: provedores ligados no servidor e o Client ID público de cada um. */
export async function getExternalProviders(): Promise<ExternalProvidersResponse> {
  const response = await apiClient.get<ExternalProvidersResponse>('/auth/external/providers')
  return response.data
}

/** Anônimo: nonce de uso único (10 min) que vai no botão do Google antes do clique. */
export async function getExternalNonce(): Promise<ExternalNonceResponse> {
  const response = await apiClient.post<ExternalNonceResponse>('/auth/external/nonce')
  return response.data
}

/**
 * Entrar com o provedor. 200 = a mesma sessão do login por senha. 400 neutro (token/nonce inválido ou
 * sem e-mail verificado), 403 `account_disabled`, 409 `link_requires_password` (ver
 * `linkRequiredFromError`), 429 no limite por IP.
 */
export async function externalLogin(
  provider: ExternalProviderName,
  data: ExternalLoginRequest,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(`/auth/external/${provider}`, data)
  return response.data
}

/** Corpo do 409 `link_requires_password` do login social, ou null quando o erro é outro. */
export function linkRequiredFromError(error: unknown): ExternalLinkRequired | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null
  const data: unknown = error.response.data
  if (!data || typeof data !== 'object') return null
  const { code, ticket, email, message } = data as Record<string, unknown>
  if (code !== LINK_REQUIRES_PASSWORD_CODE || typeof ticket !== 'string' || !ticket) return null
  return {
    ticket,
    email: typeof email === 'string' ? email : '',
    message:
      typeof message === 'string' && message.trim()
        ? message
        : 'Já existe uma conta com este e-mail. Entre com sua senha para conectar o Google.',
  }
}

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me')
  return response.data
}
