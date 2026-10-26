export interface PaymentRequest {
  entryId: string
  amount: number
  method: 'Pix' | 'Dinheiro' | 'Transferencia' | 'Outro'
  notes?: string
}

export interface Payment {
  id: string
  entryId: string
  personId: string
  personName: string
  amount: number
  method: string
  notes: string | null
  createdAt: string
}

export interface PaymentSummary {
  tournamentId: string
  totalDue: number
  totalPaid: number
  totalPending: number
  totalPrizesPending: number
  entries: PaymentEntrySummary[]
}

export interface PaymentEntrySummary {
  entryId: string
  personId: string
  personName: string
  totalDue: number
  totalPaid: number
  balance: number
  prizeAmount: number
  prizePaid: boolean
  netBalance: number
  paymentStatus: string
}

// ---------------------------------------------------------------------------------------------------------------
// Detalhamento financeiro (SPEC-20261026-1906): GET /tournaments/{id}/payments/breakdown
// Soma das formas = soma dos destinos = totalReceived (nenhum valor fica sem destino).
// ---------------------------------------------------------------------------------------------------------------

/** Forma no resumo: PIX e Dinheiro sempre; as demais só quando houver */
export type PaymentBreakdownMethod = 'Pix' | 'Dinheiro' | 'Transferencia' | 'Abatimento' | 'Outros'

export interface PaymentMethodTotal {
  method: PaymentBreakdownMethod
  /** "PIX", "Dinheiro", "Transferência", "Abatimento", "Outras formas" */
  label: string
  amount: number
  /** Lançamentos com alguma parte nesta forma (o misto conta no PIX e no dinheiro) */
  count: number
}

/** Forma da parte que foi para o destino ("Misto" = PIX + dinheiro direto no caixa) */
export type PaymentLineMethod = 'Pix' | 'Dinheiro' | 'Misto' | 'Transferencia' | 'Abatimento' | 'Outros'

export interface PaymentDestinationLine {
  transactionId: string
  entryId: string | null
  /** Apelido (ou o nome completo) */
  playerName: string
  fullName: string | null
  photoUrl: string | null
  /** Parte do lançamento que foi para este destino */
  amount: number
  method: PaymentLineMethod
  methodLabel: string
  isSettlement: boolean
  createdAt: string
}

/** CashBox = caixa (gestor financeiro); Cost = custo do torneio; Removed = custo que foi excluído */
export type PaymentDestinationKind = 'CashBox' | 'Cost' | 'Removed'

export interface PaymentDestinationDetail {
  kind: PaymentDestinationKind
  costExtraId: string | null
  description: string
  beneficiary: string | null
  costType: string | null
  /** O que o custo deveria receber (null no caixa) */
  amount: number | null
  /** Já pago no custo, por jogadores e pelo caixa (null no caixa) */
  paidAmount: number | null
  /** Soma das linhas (o que os jogadores pagaram direto para este destino, inclusive abatimentos) */
  receivedFromPlayers: number
  settledAmount: number
  /** Pago pelo caixa ao custo (botão "Pagar" da aba Custos) */
  paidByCashBox: number
  /** Quanto o custo ainda tem a receber (null no caixa) */
  remaining: number | null
  paymentStatus: string | null
  lines: PaymentDestinationLine[]
}

export interface PaymentBreakdown {
  totalReceived: number
  /** Soma do "pago" das inscrições (o "Recebido" do resumo) */
  totalPaidByEntries: number
  byMethod: PaymentMethodTotal[]
  /** Caixa primeiro, depois os custos na ordem da aba Custos; "Custo excluído" no fim, se houver */
  destinations: PaymentDestinationDetail[]
}
