export interface CostExtra {
  id: string
  tournamentId?: string
  description: string
  amount: number
  beneficiary?: string | null
  pixKey?: string | null
  pixKeyType?: string | null
  isCashBox?: boolean
  paidAmount?: number
  paymentStatus?: string
  paymentMethod?: string | null
  paidAt?: string | null
  notes?: string | null
  // legacy
  paidByPersonId?: string | null
  paidByPersonName?: string | null
  createdAt: string
}

export interface CreateCostExtraRequest {
  tournamentId: string
  description: string
  amount: number
  paidByPersonId?: string
}

export interface PixSuggestion {
  costExtraId: string | null
  description: string
  pendingAmount: number
  pixKey: string | null
  beneficiary: string | null
  matchScore: number
  suggestedPixAmount: number
  isCashBox?: boolean
}
