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
