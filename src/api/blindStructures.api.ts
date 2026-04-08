import apiClient from './client'
import type { BlindStructure } from '../types/blind.types'

export async function getAll(params?: {
  search?: string
  page?: number
  pageSize?: number
  homeGameId?: string
}): Promise<BlindStructure[]> {
  const response = await apiClient.get<BlindStructure[]>('/BlindStructures', {
    params,
  })
  return response.data
}

export async function getById(id: string): Promise<BlindStructure> {
  const response = await apiClient.get<BlindStructure>(
    `/BlindStructures/${id}`,
  )
  return response.data
}

export async function create(
  data: Omit<BlindStructure, 'id' | 'createdAt' | 'levelCount'>,
): Promise<BlindStructure> {
  const response = await apiClient.post<BlindStructure>(
    '/BlindStructures',
    data,
  )
  return response.data
}

export async function update(
  id: string,
  data: Omit<BlindStructure, 'id' | 'createdAt' | 'levelCount'>,
): Promise<BlindStructure> {
  const response = await apiClient.put<BlindStructure>(
    `/BlindStructures/${id}`,
    data,
  )
  return response.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/BlindStructures/${id}`)
}
