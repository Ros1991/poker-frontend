import apiClient from './client'
import publicClient from './publicClient'
import type {
  DealerAccess,
  DealerRequest,
  DealerRequestCreated,
  DealerRequestPoll,
} from '../types/display.types'

// QR do dealer (SPEC-20261023-1208): o organizador gera o QR; o celular do dealer
// pede acesso com o nome; o organizador autoriza, recusa ou desconecta no painel.

// ---- QR (organizador, logado) ----

export async function getActive(tournamentId: string): Promise<DealerAccess | null> {
  const response = await apiClient.get<DealerAccess | ''>(
    `/tournaments/${tournamentId}/dealer-access`,
  )
  return response.status === 204 || !response.data ? null : response.data
}

/** Gera um QR novo: o anterior deixa de valer para pedidos novos, sem derrubar quem já foi aprovado */
export async function create(tournamentId: string): Promise<DealerAccess> {
  const response = await apiClient.post<DealerAccess>(`/tournaments/${tournamentId}/dealer-access`)
  return response.data
}

/** Desativa o QR e derruba TODOS os dealers do torneio (aprovados caem na hora; pendentes são recusados) */
export async function revokeAccess(tournamentId: string): Promise<void> {
  await apiClient.delete(`/tournaments/${tournamentId}/dealer-access`)
}

// ---- Pedido de acesso (aparelho do dealer, anônimo) ----

/** Cria o pedido (ou devolve o pedido Pending/Approved que este aparelho já tem no torneio) */
export async function requestAccess(
  code: string,
  name: string,
  deviceKey: string,
): Promise<DealerRequestCreated> {
  const response = await publicClient.post<DealerRequestCreated>('/dealer-access/requests', {
    code,
    name,
    deviceKey,
  })
  return response.data
}

/** Estado do pedido; o token só vem quando aprovado e o deviceKey confere (sem rate limit: a cada 3 s) */
export async function getRequest(requestId: string, deviceKey: string): Promise<DealerRequestPoll> {
  const response = await publicClient.get<DealerRequestPoll>(`/dealer-access/requests/${requestId}`, {
    params: { deviceKey },
  })
  return response.data
}

// ---- Pedidos (organizador, logado) ----

/** Pendentes (mais antigo primeiro) e depois os dealers conectados */
export async function listRequests(tournamentId: string): Promise<DealerRequest[]> {
  const response = await apiClient.get<DealerRequest[]>(`/tournaments/${tournamentId}/dealer-requests`)
  return response.data
}

export async function approve(tournamentId: string, requestId: string): Promise<DealerRequest> {
  const response = await apiClient.post<DealerRequest>(
    `/tournaments/${tournamentId}/dealer-requests/${requestId}/approve`,
  )
  return response.data
}

export async function reject(tournamentId: string, requestId: string): Promise<DealerRequest> {
  const response = await apiClient.post<DealerRequest>(
    `/tournaments/${tournamentId}/dealer-requests/${requestId}/reject`,
  )
  return response.data
}

/** "Desconectar": derruba só aquele aparelho, na hora */
export async function revoke(tournamentId: string, requestId: string): Promise<DealerRequest> {
  const response = await apiClient.post<DealerRequest>(
    `/tournaments/${tournamentId}/dealer-requests/${requestId}/revoke`,
  )
  return response.data
}
