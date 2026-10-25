/**
 * Boas-vindas no primeiro acesso (SPEC-20261023-1212). A situação vem do mesmo `GET me` do perfil
 * (`needsOnboarding`); a conclusão é `POST me/onboarding`. Só com a sessão do usuário (token de dealer → 403).
 */
import apiClient from './client'
import type { OnboardingRequest } from '../types/onboarding.types'
import type { Profile } from '../types/profile.types'

/** `GET me`: o perfil da conta com `needsOnboarding`. */
export async function getOnboardingStatus(): Promise<Profile> {
  const response = await apiClient.get<Profile>('/me')
  return response.data
}

/** 400 com a mensagem quando algum campo não vale (plano ausente, WhatsApp sem DDD, apelido longo). */
export async function completeOnboarding(data: OnboardingRequest): Promise<Profile> {
  const response = await apiClient.post<Profile>('/me/onboarding', data)
  return response.data
}
