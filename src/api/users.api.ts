import apiClient from './client'
import type { PaginatedResponse } from '../types/common.types'
import type {
  AdminEmailSentResponse,
  AdminResetPasswordRequest,
  AdminResetPasswordResponse,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListParams,
  ChangePlanRequest,
  UpdateUserRequest,
  UserLookup,
} from '../types/user.types'

// Administração geral (SPEC-20261023-1206): tudo em /admin/users e só para o Admin do sistema (os outros papéis
// recebem 403). Não existe criar conta pela administração (D14). O lookup por e-mail fica em /Users/lookup.

/** Listagem paginada com busca e filtros (20 por página). */
export async function list(
  params: AdminUserListParams = {},
): Promise<PaginatedResponse<AdminUserListItem>> {
  const response = await apiClient.get<PaginatedResponse<AdminUserListItem>>(
    '/admin/users',
    {
      params: {
        search: params.search || undefined,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        plan: params.plan || undefined,
        status: params.status && params.status !== 'all' ? params.status : undefined,
        requested: params.requested ? true : undefined,
      },
    },
  )
  return response.data
}

export async function getById(id: string): Promise<AdminUserDetail> {
  const response = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`)
  return response.data
}

/** Editar dados e papel (sem senha). E-mail de outra conta → 409. */
export async function update(
  id: string,
  data: UpdateUserRequest,
): Promise<AdminUserDetail> {
  const response = await apiClient.put<AdminUserDetail>(`/admin/users/${id}`, data)
  return response.data
}

/** Alterar plano (grava o histórico PlanChange) → ficha atualizada. */
export async function changePlan(
  id: string,
  data: ChangePlanRequest,
): Promise<AdminUserDetail> {
  const response = await apiClient.put<AdminUserDetail>(`/admin/users/${id}/plan`, data)
  return response.data
}

/** Senha temporária, e-mail de redefinição (409 sem envio configurado) ou link de 24 h para WhatsApp. */
export async function resetPassword(
  id: string,
  data: AdminResetPasswordRequest,
): Promise<AdminResetPasswordResponse> {
  const response = await apiClient.post<AdminResetPasswordResponse>(
    `/admin/users/${id}/password`,
    data,
  )
  return response.data
}

/** Ativar/desativar (desativar derruba todas as sessões) → ficha atualizada. */
export async function setStatus(
  id: string,
  isActive: boolean,
): Promise<AdminUserDetail> {
  const response = await apiClient.patch<AdminUserDetail>(`/admin/users/${id}/status`, {
    isActive,
  })
  return response.data
}

/** Confirmar o e-mail manualmente → ficha atualizada. */
export async function confirmEmail(id: string): Promise<AdminUserDetail> {
  const response = await apiClient.post<AdminUserDetail>(`/admin/users/${id}/confirm-email`)
  return response.data
}

/** Reenviar o e-mail de confirmação (409 sem envio configurado). */
export async function resendConfirmation(id: string): Promise<AdminEmailSentResponse> {
  const response = await apiClient.post<AdminEmailSentResponse>(
    `/admin/users/${id}/confirmation-email`,
  )
  return response.data
}

/**
 * Busca uma conta por e-mail EXATO (quem administra algum home game). 404 quando não existe.
 * Usada pelo modal "Adicionar Membro" no lugar de listar todos os usuários.
 */
export async function lookupByEmail(email: string): Promise<UserLookup> {
  const response = await apiClient.get<UserLookup>('/Users/lookup', {
    params: { email },
  })
  return response.data
}
