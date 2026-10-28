import apiClient from './client'
import type {
  AiAvailableFeatures,
  AiKeyTestResult,
  AiOverview,
  UpdateAiPriceRequest,
  UpdateAiSettingsRequest,
} from '../types/ai.types'

// IA na administração (SPEC-20261027-1312).
// - /admin/ai: só o Admin do sistema (os outros recebem 403). A chave entra por PUT /admin/ai/key e nunca volta.
// - /ai (conta logada) e /tournaments/{id}/ai (terminal do dealer — o token do QR só vai nas rotas do próprio torneio):
//   recursos ligados e o aviso de uso feito no aparelho.

export async function getOverview(): Promise<AiOverview> {
  const response = await apiClient.get<AiOverview>('/admin/ai')
  return response.data
}

export async function updateSettings(data: UpdateAiSettingsRequest): Promise<AiOverview> {
  const response = await apiClient.put<AiOverview>('/admin/ai/settings', data)
  return response.data
}

/** Cadastrar ou trocar a chave (409 quando o servidor não tem AI_SECRETS_KEY). */
export async function setKey(apiKey: string): Promise<AiOverview> {
  const response = await apiClient.put<AiOverview>('/admin/ai/key', { apiKey })
  return response.data
}

export async function removeKey(): Promise<AiOverview> {
  const response = await apiClient.delete<AiOverview>('/admin/ai/key')
  return response.data
}

/** "Testar chave" pela API de modelos (sem custo de tokens). */
export async function testKey(model?: string): Promise<AiKeyTestResult> {
  const response = await apiClient.post<AiKeyTestResult>('/admin/ai/key/test', { model: model || null }, { timeout: 120000 })
  return response.data
}

export async function setFeature(key: string, enabled: boolean): Promise<AiOverview> {
  const response = await apiClient.put<AiOverview>(`/admin/ai/features/${encodeURIComponent(key)}`, { enabled })
  return response.data
}

export async function updatePrice(model: string, data: UpdateAiPriceRequest): Promise<AiOverview> {
  const response = await apiClient.put<AiOverview>(`/admin/ai/prices/${encodeURIComponent(model)}`, data)
  return response.data
}

/** Base das rotas de IA do app: a do torneio no terminal do dealer, a geral no resto. */
function appBase(tournamentId?: string | null) {
  return tournamentId ? `/tournaments/${tournamentId}/ai` : '/ai'
}

/** Recursos de IA ligados agora (ex.: ["tirar-o-fundo"]). */
export async function getAvailableFeatures(tournamentId?: string | null): Promise<AiAvailableFeatures> {
  const response = await apiClient.get<AiAvailableFeatures>(`${appBase(tournamentId)}/features`)
  return response.data
}

/** Aviso de uso de um recurso que roda no aparelho (a tela de IA conta). */
export async function recordUsage(
  feature: string,
  context: { tournamentId?: string | null; personId?: string | null } = {},
): Promise<void> {
  await apiClient.post(`${appBase(context.tournamentId)}/usage`, {
    feature,
    personId: context.personId ?? null,
  })
}
