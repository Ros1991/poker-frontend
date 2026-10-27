import type { PixKeyType } from '../utils/pix'

export interface CostExtra {
  id: string
  tournamentId?: string
  description: string
  amount: number
  costType?: string
  beneficiary?: string | null
  pixKey?: string | null
  /** Tipo da chave gravada (Cpf, Cnpj, Phone, Email, Evp), derivado pela API — SPEC-20261023-1218 */
  pixKeyType?: PixKeyType | null
  isCashBox?: boolean
  paidAmount?: number
  /** Quanto os jogadores pagaram direto a este custo (PIX e abatimentos que valem) — revisão geral 2 */
  paidByPlayers?: number
  /** Parte do pago que foi pelo caixa (botão Dinheiro/Caixa): só ela se desfaz no "Reverter pagamento" */
  paidByCashBox?: number
  /** Recebido (dos jogadores e/ou do caixa) acima do valor: custo que encolheu depois de pago — revisão geral 2 */
  overReceived?: number
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
  /** Tipo ESCOLHIDO na tela (null = a API detecta); o gravado é sempre o da chave normalizada */
  pixKeyType?: PixKeyType | null
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
