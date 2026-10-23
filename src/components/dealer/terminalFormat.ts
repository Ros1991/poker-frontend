// Formatação compartilhada pelos componentes do terminal do dealer
import type { TournamentEntry } from '../../types/entry.types'
import type { Table } from '../../api/tables.api'
import { tableLabel } from '../../utils/tableBalance'

export { isActiveStatus, tableLabel } from '../../utils/tableBalance'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** HH:mm no fuso do aparelho */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function playerName(entry: Pick<TournamentEntry, 'person'>): string {
  return entry.person.nickname?.trim() || entry.person.fullName
}

/** Quanto falta pagar (nunca negativo) */
export function amountDue(entry: TournamentEntry): number {
  return Math.max(0, entry.totalDue - entry.totalPaid)
}

/** "Mesa 2, lugar 5" / "Sem mesa" */
export function seatLabel(entry: TournamentEntry, tables: Table[] | undefined): string {
  if (!entry.tableId) return 'Sem mesa'
  const table = tables?.find((t) => t.id === entry.tableId)
  const name = table ? tableLabel(table) : 'Mesa'
  return entry.seatNumber ? `${name}, lugar ${entry.seatNumber}` : name
}

/** Situação curta do jogador no torneio */
export function statusLabel(entry: TournamentEntry): string {
  switch (entry.status) {
    case 'Active':
    case 'Registered':
      return 'Jogando'
    case 'Eliminated':
      return entry.finalPosition ? `Saiu em ${entry.finalPosition}º` : 'Saiu'
    case 'Awarded':
    case 'PaidOut':
      return entry.finalPosition ? `Terminou em ${entry.finalPosition}º` : 'Premiado'
    default:
      return entry.status
  }
}

/** Mensagem de erro do servidor ({ message }) ou o texto padrão */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return msg || fallback
}

/** Minúsculas e sem acento, para busca por nome */
export function normalizeText(text: string): string {
  // Remove os acentos (marcas combinantes)
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}
