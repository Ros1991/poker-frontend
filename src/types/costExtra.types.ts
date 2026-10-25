export interface CostExtra {
  id: string
  tournamentId?: string
  description: string
  amount: number
  costType?: string
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

/** Custo que veio dos custos padrão da estrutura de blinds (selo "Padrão"); comporta-se como o manual. */
export const COST_TYPE_DEFAULT = 'Default'

/**
 * Criar/editar custo. O PUT grava o pedido inteiro (menos o tipo e o Caixa, que o backend preserva): a edição
 * manda todos os campos do custo para não apagar beneficiário e chave PIX (SPEC-20261023-1215, CP9).
 */
export interface CreateCostExtraRequest {
  tournamentId: string
  description: string
  amount: number
  beneficiary?: string | null
  pixKey?: string | null
  pixKeyType?: string | null
  isCashBox?: boolean
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
