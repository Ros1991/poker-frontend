import apiClient from './client'
import publicClient from './publicClient'
import type { DealerAccess, DealerExchange } from '../types/display.types'

// QR do dealer: o organizador gera; o celular do dealer troca o código por um acesso

export async function getActive(tournamentId: string): Promise<DealerAccess | null> {
  const response = await apiClient.get<DealerAccess | ''>(
    `/tournaments/${tournamentId}/dealer-access`,
  )
  return response.status === 204 || !response.data ? null : response.data
}

export async function create(tournamentId: string): Promise<DealerAccess> {
  const response = await apiClient.post<DealerAccess>(`/tournaments/${tournamentId}/dealer-access`)
  return response.data
}

export async function revoke(tournamentId: string): Promise<void> {
  await apiClient.delete(`/tournaments/${tournamentId}/dealer-access`)
}

export async function exchange(code: string): Promise<DealerExchange> {
  const response = await publicClient.post<DealerExchange>('/dealer-access/exchange', { code })
  return response.data
}
