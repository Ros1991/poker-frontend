import apiClient from './client'

export interface PrizeItem {
  position: number
  amount: number
  percentage: number
}

export interface PrizeCalculationResult {
  grossPrizePool: number
  totalCosts: number
  netPrizePool: number
  suggestedPrizeCount: number
  prizes: PrizeItem[]
  remainder: number
}

export async function calculate(
  tournamentId: string,
  prizeCount?: number,
): Promise<PrizeCalculationResult> {
  const params = prizeCount ? `?prizeCount=${prizeCount}` : ''
  const response = await apiClient.get<PrizeCalculationResult>(
    `/tournaments/${tournamentId}/prizes/calculate${params}`,
  )
  return response.data
}

export async function confirm(
  tournamentId: string,
  prizes: { position: number; amount: number }[],
): Promise<void> {
  await apiClient.post(`/tournaments/${tournamentId}/prizes/confirm`, {
    prizes,
  })
}
