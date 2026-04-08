import apiClient from './client'
import type {
  LoginRequest,
  LoginResponse,
  AuthUser,
  RefreshTokenRequest,
  RegisterRequest,
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

export async function getMe(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me')
  return response.data
}
