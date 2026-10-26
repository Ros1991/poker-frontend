import apiClient from './client'
import type { Payment, PaymentBreakdown, PaymentSummary } from '../types/payment.types'
import type { PixSuggestion } from '../types/costExtra.types'

export interface CreatePaymentInput {
  tournamentId: string
  entryId: string
  amount: number
  method: 'Pix' | 'Dinheiro' | 'Mixed'
  pixAmount?: number
  cashAmount?: number
  pixDestinationCostExtraId?: string | null
  notes?: string
}

export async function create(data: CreatePaymentInput): Promise<Payment> {
  const { tournamentId, entryId, ...body } = data
  const response = await apiClient.post<Payment>(
    `/tournaments/${tournamentId}/payments/entries/${entryId}`,
    body,
  )
  return response.data
}

export interface EntryPaymentItem {
  id: string
  amount: number
  paymentMethod: string | null
  pixAmount: number | null
  cashAmount: number | null
  pixDestinationId: string | null
  description: string | null
  createdAt: string
}

export async function getByEntry(
  tournamentId: string,
  entryId: string,
): Promise<EntryPaymentItem[]> {
  const response = await apiClient.get<EntryPaymentItem[]>(
    `/tournaments/${tournamentId}/payments/entries/${entryId}`,
  )
  return response.data
}

export async function settleAgainstCost(
  tournamentId: string,
  entryId: string,
  costExtraId: string,
  amount: number,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/payments/entries/${entryId}/settle-against-cost`,
    { costExtraId, amount },
  )
}

export async function reversePayment(
  tournamentId: string,
  entryId: string,
  paymentId: string,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${tournamentId}/payments/entries/${entryId}/${paymentId}/reverse`,
  )
}

export interface PaymentTotalsByMethod {
  totalPix: number
  totalCash: number
  totalToCosts: number
  totalPending: number
}

export async function getTotalsByMethod(
  tournamentId: string,
): Promise<PaymentTotalsByMethod> {
  const response = await apiClient.get<PaymentTotalsByMethod>(
    `/tournaments/${tournamentId}/payments/totals-by-method`,
  )
  return response.data
}

export async function getSummary(
  tournamentId: string,
): Promise<PaymentSummary> {
  const response = await apiClient.get<PaymentSummary>(
    `/tournaments/${tournamentId}/payments/summary`,
  )
  return response.data
}

/**
 * Detalhamento financeiro (SPEC-20261026-1906): resumo por forma de pagamento e, para o caixa e cada custo, quem pagou
 * (jogador, valor, forma, hora). Só o organizador (aba Financeiro).
 */
export async function getBreakdown(tournamentId: string): Promise<PaymentBreakdown> {
  const response = await apiClient.get<PaymentBreakdown>(`/tournaments/${tournamentId}/payments/breakdown`)
  return response.data
}

/**
 * Destinos do PIX: o Caixa (custo marcado como caixa, se houver, com isCashBox) primeiro; depois os custos que ainda
 * têm a receber, cada um com pendingAmount = o máximo que ainda recebe (SPEC-20261026-1906).
 */
export async function getPixSuggestions(
  tournamentId: string,
): Promise<PixSuggestion[]> {
  const response = await apiClient.get<PixSuggestion[]>(
    `/tournaments/${tournamentId}/payments/pix-suggestions`,
  )
  return response.data
}
