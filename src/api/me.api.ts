/**
 * "Meu perfil" (SPEC-20261023-1211): a conta logada mexe só nos próprios dados (`me/*`, com a sessão do usuário;
 * token de dealer recebe 403). O plano (`me/plan`) continua em `plan.api.ts`.
 */
import apiClient from './client'
import type { ExternalProviderName } from '../types/auth.types'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  ConnectExternalLoginRequest,
  DeleteAccountRequest,
  DeviceSession,
  ExternalLogins,
  PasswordSetupLinkResponse,
  Profile,
  UpdateProfileRequest,
} from '../types/profile.types'

export async function getProfile(): Promise<Profile> {
  const response = await apiClient.get<Profile>('/me')
  return response.data
}

/** 400 com a mensagem quando algum campo não vale (nome vazio, WhatsApp sem DDD…). */
export async function updateProfile(data: UpdateProfileRequest): Promise<Profile> {
  const response = await apiClient.put<Profile>('/me', data)
  return response.data
}

/** Foto já recortada pelo PhotoCropDialog (JPEG 512 × 512) — exibida sempre redonda. */
export async function uploadPhoto(photo: Blob): Promise<Profile> {
  const formData = new FormData()
  formData.append('file', photo, 'foto.jpg')
  const response = await apiClient.post<Profile>('/me/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

export async function removePhoto(): Promise<Profile> {
  const response = await apiClient.delete<Profile>('/me/photo')
  return response.data
}

/** Exige a senha atual; os outros aparelhos saem e este continua. 400 senha atual errada; 429 tentativas demais. */
export async function changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const response = await apiClient.post<ChangePasswordResponse>('/me/password', data)
  return response.data
}

/** Conta sem senha: manda por e-mail o link "Definir sua senha". 429 se pediu há menos de 2 min. */
export async function requestPasswordSetupLink(): Promise<PasswordSetupLinkResponse> {
  const response = await apiClient.post<PasswordSetupLinkResponse>('/me/password/setup-link')
  return response.data
}

export async function getLogins(): Promise<ExternalLogins> {
  const response = await apiClient.get<ExternalLogins>('/me/logins')
  return response.data
}

/** ID token do botão do Google + o nonce que a API emitiu para ele. */
export async function connectLogin(
  provider: ExternalProviderName,
  data: ConnectExternalLoginRequest,
): Promise<ExternalLogins> {
  const response = await apiClient.post<ExternalLogins>(`/me/logins/${provider}`, data)
  return response.data
}

/** 400 quando é a única forma de entrar na conta. */
export async function disconnectLogin(provider: ExternalProviderName): Promise<ExternalLogins> {
  const response = await apiClient.delete<ExternalLogins>(`/me/logins/${provider}`)
  return response.data
}

export async function getSessions(): Promise<DeviceSession[]> {
  const response = await apiClient.get<DeviceSession[]>('/me/sessions')
  return response.data ?? []
}

export async function revokeSession(id: string): Promise<void> {
  await apiClient.delete(`/me/sessions/${id}`)
}

export async function revokeOtherSessions(): Promise<number> {
  const response = await apiClient.post<{ revoked: number }>('/me/sessions/revoke-others')
  return response.data?.revoked ?? 0
}

/** 204 = conta anonimizada e todas as sessões derrubadas (inclusive esta). */
export async function deleteAccount(data: DeleteAccountRequest): Promise<void> {
  await apiClient.delete('/me', { data })
}
