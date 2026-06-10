import apiClient from './client'
import type {
  CostExtra,
  CreateCostExtraRequest,
} from '../types/costExtra.types'

export async function getAll(tournamentId: string): Promise<CostExtra[]> {
  const response = await apiClient.get<CostExtra[]>(
    `/tournaments/${tournamentId}/cost-extras`,
  )
  return response.data
}

export async function create(
  tournamentId: string,
  data: Omit<CreateCostExtraRequest, 'tournamentId'>,
): Promise<CostExtra> {
  const response = await apiClient.post<CostExtra>(
    `/tournaments/${tournamentId}/cost-extras`,
    { ...data, tournamentId },
  )
  return response.data
}

export async function update(
  tournamentId: string,
  costId: string,
  data: Partial<Omit<CreateCostExtraRequest, 'tournamentId'>>,
): Promise<CostExtra> {
  const response = await apiClient.put<CostExtra>(
    `/tournaments/${tournamentId}/cost-extras/${costId}`,
    data,
  )
  return response.data
}

export async function pay(
  tournamentId: string,
  costId: string,
  data: { method: 'Pix' | 'Dinheiro' | 'Caixa' },
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/cost-extras/${costId}/pay`,
    data,
  )
}

export async function unpay(
  tournamentId: string,
  costId: string,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/cost-extras/${costId}/unpay`,
  )
}

export async function remove(
  tournamentId: string,
  costId: string,
): Promise<void> {
  await apiClient.delete(`/tournaments/${tournamentId}/cost-extras/${costId}`)
}
