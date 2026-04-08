import type { TournamentStatus } from '../types/tournament.types'
import type { EntryStatus, PaymentStatus } from '../types/entry.types'

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  Draft: 'Rascunho',
  OpenForRegistration: 'Iniciado',
  InProgress: 'Iniciado',
  BreakSettlement: 'Rebuys Finalizados',
  Finished: 'Finalizado',
  Cancelled: 'Cancelado',
}

export const TOURNAMENT_STATUS_COLORS: Record<TournamentStatus, string> = {
  Draft: 'bg-gray-500/20 text-gray-300',
  OpenForRegistration: 'bg-blue-500/20 text-blue-400',
  InProgress: 'bg-blue-500/20 text-blue-400',
  BreakSettlement: 'bg-yellow-500/20 text-yellow-400',
  Finished: 'bg-purple-500/20 text-purple-400',
  Cancelled: 'bg-red-500/20 text-red-400',
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  Registered: 'Inscrito',
  Active: 'Ativo',
  Eliminated: 'Eliminado',
  Awarded: 'Premiado',
  PaidOut: 'Pago',
}

export const ENTRY_STATUS_COLORS: Record<EntryStatus, string> = {
  Registered: 'bg-blue-500/20 text-blue-400',
  Active: 'bg-green-500/20 text-green-400',
  Eliminated: 'bg-red-500/20 text-red-400',
  Awarded: 'bg-yellow-500/20 text-yellow-400',
  PaidOut: 'bg-purple-500/20 text-purple-400',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pendente',
  PartiallyPaid: 'Parcial',
  Paid: 'Pago',
  Overpaid: 'Pago a Mais',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  Pending: 'bg-red-500/20 text-red-400',
  PartiallyPaid: 'bg-yellow-500/20 text-yellow-400',
  Paid: 'bg-green-500/20 text-green-400',
  Overpaid: 'bg-blue-500/20 text-blue-400',
}
