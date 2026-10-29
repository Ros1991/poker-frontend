// Textos da área do jogador (SPEC-20261029-1726) — os mesmos no Início ("Como jogador"), em /meus-torneios e no torneio
// ao vivo. Os números vêm prontos da API (só da própria conta); aqui só a apresentação.
import type { BadgeColor } from '../../components/ui/Badge'
import type { TournamentStatus } from '../../types/tournament.types'
import type { MyTournament } from '../../types/mePlayer.types'
import { entryStatusParts } from '../../utils/entryStatusLine'
import type { EntryStatusPart } from '../../utils/entryStatusLine'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatMoney(value: number | null | undefined): string {
  return BRL.format(Math.round((value ?? 0) * 100) / 100)
}

/** "qua., 29 de out. · 20:00" */
export function formatTournamentDay(iso: string): string {
  try {
    const d = new Date(iso)
    const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(d)
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d)
    return `${day} · ${time}`
  } catch {
    return iso
  }
}

/** Inscrições abertas, em andamento ou rebuys finalizados: o torneio está acontecendo */
export function isLiveStatus(status: TournamentStatus): boolean {
  return status === 'OpenForRegistration' || status === 'InProgress' || status === 'BreakSettlement'
}

/** Status do torneio para quem joga (o rascunho do organizador é "Agendado" para o jogador) */
export function playerTournamentStatus(status: TournamentStatus): { label: string; color: BadgeColor } {
  switch (status) {
    case 'Draft':
      return { label: 'Agendado', color: 'gray' }
    case 'OpenForRegistration':
    case 'InProgress':
      return { label: 'Ao vivo', color: 'blue' }
    case 'BreakSettlement':
      return { label: 'Rebuys finalizados', color: 'yellow' }
    case 'Finished':
      return { label: 'Finalizado', color: 'purple' }
    default:
      return { label: 'Cancelado', color: 'red' }
  }
}

/** Ainda no jogo (inscrito ou ativo) */
export function isStillPlaying(t: Pick<MyTournament, 'entryStatus'>): boolean {
  return t.entryStatus === 'Active' || t.entryStatus === 'Registered'
}

/**
 * Resultado da conta no torneio: "Campeão", "3º de 12", "Jogando" (ainda na mesa de um torneio acontecendo) ou null
 * (agendado, ou terminou sem posição registrada).
 */
export function resultText(t: Pick<MyTournament, 'finalPosition' | 'totalEntries' | 'entryStatus' | 'status'>): string | null {
  if (t.finalPosition === 1) return 'Campeão'
  if (t.finalPosition != null) return `${t.finalPosition}º de ${t.totalEntries}`
  if (isLiveStatus(t.status) && isStillPlaying(t)) return 'Jogando'
  return null
}

/**
 * A linha dos números, como o card do dealer e o telão: "2 rebuys · Add-on · Deve R$ 90,00" (o saldo só quando o
 * organizador tem o controle de pagamentos).
 */
export function numbersParts(t: Pick<MyTournament, 'rebuyCount' | 'addonCount' | 'balance' | 'showsPayments'>): EntryStatusPart[] {
  return entryStatusParts(
    { rebuyCount: t.rebuyCount, addonCount: t.addonCount, balance: t.balance ?? 0 },
    { showMoney: t.showsPayments && t.balance != null },
  )
}

/** Prêmio e bounties ganhos, quando houver: ["Prêmio R$ 300,00", "Bounties R$ 40,00"] */
export function winningsParts(t: Pick<MyTournament, 'prizeAmount' | 'bountyWon'>): string[] {
  const parts: string[] = []
  if (t.prizeAmount != null && t.prizeAmount > 0) parts.push(`Prêmio ${formatMoney(t.prizeAmount)}`)
  if (t.bountyWon != null && t.bountyWon > 0) parts.push(`Bounties ${formatMoney(t.bountyWon)}`)
  return parts
}
