import { Mail } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { MePlayerSummary } from '../../types/mePlayer.types'
import { formatMoney } from './myTournamentFormat'

/**
 * Os números de quem joga (SPEC-20261029-1726): torneios, vitórias, ITM e quanto está em aberto (só dos organizadores
 * com o controle de pagamentos). No Início e em /meus-torneios.
 */
export function PlayerStats({ summary, className }: { summary: MePlayerSummary; className?: string }) {
  const items = [
    { key: 'torneios', label: 'Torneios', value: String(summary.tournamentCount) },
    { key: 'vitorias', label: 'Vitórias', value: String(summary.wins) },
    { key: 'itm', label: 'Na premiação', value: String(summary.inTheMoney) },
    {
      key: 'aberto',
      label: 'Em aberto',
      value: formatMoney(summary.openBalance),
      tone: summary.openBalance > 0 ? 'text-accent-red-deep' : 'text-accent-green-deep',
    },
  ]
  return (
    <dl className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', className)} data-player-stats>
      {items.map((item) => (
        <div key={item.key} className="rounded-xl border border-border-default bg-bg-card px-3 py-2" data-player-stat={item.key}>
          <dt className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-secondary">{item.label}</dt>
          <dd className={cn('mt-0.5 text-xl font-bold tabular-nums text-text-primary', item.tone)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Conta sem nenhuma inscrição vinculada: o organizador liga o jogador à conta cadastrando o e-mail dela (SPEC-20261029-1725).
 */
export function PlayerEmailHint({ email, className }: { email: string; className?: string }) {
  return (
    <div
      className={cn('flex items-start gap-3 rounded-xl border border-dashed border-border-input bg-bg-secondary p-4', className)}
      data-player-hint
    >
      <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent-blue" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary">Você joga em algum home game?</p>
        <p className="mt-0.5 text-sm text-text-secondary">
          Peça ao organizador para cadastrar seu e-mail{' '}
          <span className="break-all font-medium text-text-primary" data-player-hint-email>
            {email}
          </span>
          . Assim os torneios em que você joga aparecem aqui, com rebuys, quanto deve e o relógio ao vivo.
        </p>
      </div>
    </div>
  )
}
