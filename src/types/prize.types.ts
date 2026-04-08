export interface PrizeAllocation {
  position: number
  percentage: number
  amount: number
  personId: string | null
  personName: string | null
}

export interface PrizeDistributionResult {
  totalPrizePool: number
  totalCosts: number
  netPrizePool: number
  allocations: PrizeAllocation[]
}

export interface UpdatePrizeRequest {
  tournamentId: string
  allocations: {
    position: number
    percentage: number
    personId?: string
  }[]
}
