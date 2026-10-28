// Formatação compartilhada pelos componentes do terminal do dealer (e da aba Jogadores do painel — SPEC-20261023-1217)
import type { TournamentEntry } from '../../types/entry.types'
import type { Tournament } from '../../types/tournament.types'
import type { Table } from '../../api/tables.api'
import type { PlayerActionRules } from './PlayerCard'
import { tableLabel } from '../../utils/tableBalance'
import { normalizeText } from '../../utils/text'

export { isActiveStatus, tableLabel } from '../../utils/tableBalance'
// Busca sem acento: utilitário único em utils/text.ts (SPEC-20261023-1213)
export { normalizeText } from '../../utils/text'

/**
 * Rebuy até o limite do torneio (0 = sem limite); add-on só se o torneio tem e o jogador ainda não chegou ao máximo de
 * add-ons (SPEC-20261027-1311; 0 = sem limite) — no máximo o botão fica desabilitado.
 */
export function playerActionRules(
  tournament: Pick<Tournament, 'maxRebuys' | 'addonAllowed' | 'maxAddons'> | undefined,
  entry: Pick<TournamentEntry, 'rebuyCount' | 'addonCount'>,
): PlayerActionRules {
  const maxRebuys = tournament?.maxRebuys ?? 0
  return {
    canRebuy: !(maxRebuys > 0 && entry.rebuyCount >= maxRebuys),
    canAddon: (tournament?.addonAllowed ?? false) && addonsLeft(tournament, entry) !== 0,
  }
}

/** Quantos add-ons o jogador ainda pode comprar (SPEC-20261027-1311); null = sem limite (máximo 0) */
export function addonsLeft(
  tournament: Pick<Tournament, 'maxAddons'> | undefined,
  entry: Pick<TournamentEntry, 'addonCount'>,
): number | null {
  const max = tournament?.maxAddons ?? 1
  return max > 0 ? Math.max(0, max - (entry.addonCount ?? 0)) : null
}

/** "Sem add-on" / "Add-on" / "3 add-ons" */
export function addonCountLabel(count: number): string {
  return count <= 0 ? 'Sem add-on' : count === 1 ? 'Add-on' : `${count} add-ons`
}

/** Busca por nome completo e apelido, sem acento e sem diferença de maiúsculas ("jose" acha "José") */
export function matchesPlayerSearch(entry: Pick<TournamentEntry, 'person'>, term: string): boolean {
  const t = normalizeText(term.trim())
  if (!t) return true
  return (
    normalizeText(entry.person.fullName).includes(t) ||
    (!!entry.person.nickname && normalizeText(entry.person.nickname).includes(t))
  )
}

export interface TableGroup {
  /** id da mesa ou "sem-mesa" */
  key: string
  table: Table | null
  title: string
  entries: TournamentEntry[]
}

/**
 * Quem está jogando agrupado por mesa: mesas em ordem de número (só as que têm alguém), jogadores pela ordem do
 * lugar; quem não tem mesa (ou está numa mesa que não veio na lista) fica em "Sem mesa", por nome, por último.
 */
export function groupActiveByTable(entries: TournamentEntry[], tables: Table[]): TableGroup[] {
  const byTable = new Map<string, TournamentEntry[]>()
  const unseated: TournamentEntry[] = []
  const known = new Set(tables.map((t) => t.id))
  for (const e of entries) {
    if (e.tableId && known.has(e.tableId)) {
      const list = byTable.get(e.tableId) ?? []
      list.push(e)
      byTable.set(e.tableId, list)
    } else {
      unseated.push(e)
    }
  }
  const groups: TableGroup[] = [...tables]
    .sort((a, b) => a.tableNumber - b.tableNumber)
    .filter((t) => (byTable.get(t.id)?.length ?? 0) > 0)
    .map((t) => ({
      key: t.id,
      table: t,
      title: tableLabel(t),
      entries: [...(byTable.get(t.id) ?? [])].sort((a, b) => (a.seatNumber ?? 999) - (b.seatNumber ?? 999)),
    }))
  if (unseated.length > 0)
    groups.push({
      key: 'sem-mesa',
      table: null,
      title: 'Sem mesa',
      entries: [...unseated].sort((a, b) => playerName(a).localeCompare(playerName(b), 'pt-BR')),
    })
  return groups
}

/**
 * Composição do total do jogador: "buy-in R$ 100,00 + 2 rebuys R$ 200,00 + add-on R$ 50,00". O que o torneio cobra
 * por jogador além do buy-in (staff e ranking fixo) entra com o próprio nome; sobra que não fecha com eles vira "outros".
 */
export function entryTotalBreakdown(
  entry: Pick<
    TournamentEntry,
    'buyInAmount' | 'rebuyCount' | 'rebuyTotal' | 'addonCount' | 'addonAmount' | 'totalDue'
  >,
  tournament: Pick<Tournament, 'staffAmount' | 'rankingContribMode' | 'rankingContribValue'> | undefined,
): string {
  const parts = [`buy-in ${formatCurrency(entry.buyInAmount)}`]
  const addonPart = entry.addonCount > 0 ? entry.addonAmount : 0
  const other = Math.round((entry.totalDue - entry.buyInAmount - entry.rebuyTotal - addonPart) * 100) / 100
  if (other > 0) {
    const staff = tournament?.staffAmount ?? 0
    const ranking = tournament?.rankingContribMode === 'PerPlayer' ? (tournament.rankingContribValue ?? 0) : 0
    const close = (a: number, b: number) => Math.abs(a - b) < 0.005
    if (staff > 0 && ranking > 0 && close(staff + ranking, other)) {
      parts.push(`staff ${formatCurrency(staff)}`, `ranking ${formatCurrency(ranking)}`)
    } else if (staff > 0 && close(staff, other)) {
      parts.push(`staff ${formatCurrency(staff)}`)
    } else if (ranking > 0 && close(ranking, other)) {
      parts.push(`ranking ${formatCurrency(ranking)}`)
    } else {
      parts.push(`outros ${formatCurrency(other)}`)
    }
  }
  if (entry.rebuyCount > 0)
    parts.push(`${entry.rebuyCount} rebuy${entry.rebuyCount > 1 ? 's' : ''} ${formatCurrency(entry.rebuyTotal)}`)
  if (entry.addonCount > 0)
    parts.push(`${entry.addonCount === 1 ? 'add-on' : `${entry.addonCount} add-ons`} ${formatCurrency(entry.addonAmount)}`)
  return parts.join(' + ')
}

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

/** "Eliminou 1 jogador" / "Eliminou 3 jogadores" — quantas pessoas o jogador eliminou (SPEC-20261026-1908) */
export function eliminationsText(count: number): string {
  return `Eliminou ${count} ${count === 1 ? 'jogador' : 'jogadores'}`
}

/**
 * Quem este jogador eliminou, na ordem em que saíram (pela lista de inscrições: `eliminatedById` aponta quem eliminou;
 * eliminação desfeita volta a null). Usado na Ficha.
 */
export function eliminatedByEntry(entry: Pick<TournamentEntry, 'id'>, entries: TournamentEntry[]): TournamentEntry[] {
  return entries
    .filter((e) => e.eliminatedById === entry.id && e.id !== entry.id)
    .sort((a, b) => (a.eliminatedAt ?? '').localeCompare(b.eliminatedAt ?? ''))
}

/** "Ana", "Ana e Beto", "Ana, Beto e Caio" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
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
