import apiClient from './client'
import type {
  LoginRequest,
  LoginResponse,
  AuthUser,
  RefreshTokenRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth.types'

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', data)
  return response.data
}

export async function register(data: RegisterRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/register', data)
  return response.data
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
