import apiClient from './client'
import type { PaginatedResponse } from '../types/common.types'
import type {
  User,
  CreateUserRequest,
  UpdateUserRequest,
} from '../types/user.types'

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
