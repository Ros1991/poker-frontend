import apiClient from './client'
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
  ResendConfirmationRequest,
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

/** Anônimo: 204 confirma o e-mail; 400 com message quando o link não vale mais; 429 no rate limit. */
export async function confirmEmail(token: string): Promise<void> {
  const body: ConfirmEmailRequest = { token }
  await apiClient.post('/auth/confirm-email', body)
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

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me')
  return response.data
}
