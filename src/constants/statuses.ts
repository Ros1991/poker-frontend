import type { TournamentStatus } from '../types/tournament.types'
import type { EntryStatus, PaymentStatus } from '../types/entry.types'
import type { BadgeColor } from '../components/ui/Badge'

/**
 * ÚNICA tabela de rótulo e cor por status (torneio, inscrição, pagamento), consumida pelo painel
 * e pelo telão (SPEC-20261023-1204). Não duplique estes mapas nas páginas.
 *
 * CONTRATO: `*_STATUS_COLORS` devolve a CHAVE de cor do `Badge` (`BadgeColor`: 'green' | 'red' |
 * 'gold' | 'yellow' | 'blue' | 'purple' | 'orange' | 'gray'), e não mais uma string de classes.
 * Use sempre o Badge:
 *
 *   <Badge color={ENTRY_STATUS_COLORS[entry.status]}>{ENTRY_STATUS_LABELS[entry.status]}</Badge>
 *
 * Nunca `className={ENTRY_STATUS_COLORS[...]}`. Quem precisa de outra forma (borda da linha, ícone)
 * deriva os tokens a partir da mesma chave, para a cor do status ser uma só em todo o sistema.
 */

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  Draft: 'Rascunho',
  OpenForRegistration: 'Iniciado',
  InProgress: 'Iniciado',
  BreakSettlement: 'Rebuys Finalizados',
  Finished: 'Finalizado',
  Cancelled: 'Cancelado',
}

export const TOURNAMENT_STATUS_COLORS: Record<TournamentStatus, BadgeColor> = {
  Draft: 'gray',
  OpenForRegistration: 'blue',
  InProgress: 'blue',
  BreakSettlement: 'yellow',
  Finished: 'purple',
  Cancelled: 'red',
}

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  Registered: 'Inscrito',
  Active: 'Ativo',
  Eliminated: 'Eliminado',
  Awarded: 'Premiado',
  PaidOut: 'Pago',
}

export const ENTRY_STATUS_COLORS: Record<EntryStatus, BadgeColor> = {
  Registered: 'blue',
  Active: 'green',
  Eliminated: 'red',
  Awarded: 'gold',
  PaidOut: 'purple',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pendente',
  PartiallyPaid: 'Parcial',
  Paid: 'Pago',
  Overpaid: 'Pago a Mais',
}

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, BadgeColor> = {
  Pending: 'red',
  PartiallyPaid: 'yellow',
  Paid: 'green',
  Overpaid: 'blue',
}
