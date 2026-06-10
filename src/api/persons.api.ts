import apiClient from './client'
import type {
  Person,
  CreatePersonRequest,
  UpdatePersonRequest,
} from '../types/person.types'

export async function getByHomeGame(
  homeGameId: string,
  type?: 'Jogador' | 'Dealer',
): Promise<Person[]> {
  const response = await apiClient.get<Person[]>('/Persons', {
    params: { homeGameId, type },
  })
  return response.data
}

export async function getById(id: string): Promise<Person> {
  const response = await apiClient.get<Person>(`/Persons/${id}`)
  return response.data
}

export async function create(data: CreatePersonRequest): Promise<Person> {
  const response = await apiClient.post<Person>('/Persons', data)
  return response.data
}

export async function update(
  id: string,
  data: UpdatePersonRequest,
): Promise<Person> {
  const response = await apiClient.put<Person>(`/Persons/${id}`, data)
  return response.data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/Persons/${id}`)
}

export async function uploadPhoto(id: string, file: File): Promise<Person> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await apiClient.post<Person>(
    `/Persons/${id}/photo`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  )
  return response.data
}

export interface PlayerHistoryItem {
  tournamentId: string
  tournamentName: string
  date: string
  position: number
  prize: number
  points: number
}

export async function getHistory(id: string): Promise<PlayerHistoryItem[]> {
  const response = await apiClient.get<PlayerHistoryItem[]>(
    `/Persons/${id}/history`,
  )
  return response.data
}
