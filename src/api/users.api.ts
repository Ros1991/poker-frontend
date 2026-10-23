import apiClient from './client'
import type { PaginatedResponse } from '../types/common.types'
import type {
  User,
  UserLookup,
  CreateUserRequest,
  UpdateUserRequest,
} from '../types/user.types'

/** Lista completa: só Admin do sistema (UserListPage). Outros papéis recebem 403. */
export async function getAll(params?: {
  search?: string
  page?: number
  pageSize?: number
}): Promise<PaginatedResponse<User>> {
  const response = await apiClient.get<PaginatedResponse<User>>('/Users', {
    params,
  })
  return response.data
}

/**
 * Busca uma conta por e-mail EXATO (qualquer usuário logado). 404 quando não existe.
 * Usada pelo modal "Adicionar Membro" no lugar de listar todos os usuários.
 */
export async function lookupByEmail(email: string): Promise<UserLookup> {
  const response = await apiClient.get<UserLookup>('/Users/lookup', {
    params: { email },
  })
  return response.data
}

export async function getById(id: string): Promise<User> {
  const response = await apiClient.get<User>(`/Users/${id}`)
  return response.data
}

export async function create(data: CreateUserRequest): Promise<User> {
  const response = await apiClient.post<User>('/Users', data)
  return response.data
}

export async function update(
  id: string,
  data: UpdateUserRequest,
): Promise<User> {
  const response = await apiClient.put<User>(`/Users/${id}`, data)
  return response.data
}
