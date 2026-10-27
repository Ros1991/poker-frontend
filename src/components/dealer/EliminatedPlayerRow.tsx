import { ChevronRight } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { cn } from '../../utils/cn'
import type { TournamentEntry } from '../../types/entry.types'
import type { KnockoutType } from '../../utils/knockout'
import { BountyLabel, DueLabel, EliminationsLabel } from './PlayerCard'
import { isActiveStatus, playerName, statusLabel } from './terminalFormat'

interface EliminatedPlayerRowProps {
  entry: TournamentEntry
  /** Toque na linha: abre a Ficha */
  onOpen: () => void
  /** Prêmio do jogador, ex.: "R$ 300,00 · pago" (painel) */
  prizeText?: string | null
  /** "Deve/Pago/Pagou a mais" pequeno (painel, com Payments no plano do dono) */
  showDue?: boolean
  /** Formato do torneio (SPEC-20261026-1909): bounties ganhos (e a cabeça no PKO) */
  knockout?: KnockoutType
}

/**
 * Linha compacta do jogador que saiu (terminal do dealer e aba Jogadores do painel — SPEC-20261023-1217): foto
 * redonda, nome, situação ("Saiu em 5º") e chevron; tocar abre a Ficha. Sem `prizeText`/`showDue` fica igual à do
 * terminal. Também serve para quem ainda joga quando o caixa está fechado (sem botoeira, L16).
 * Fundo zebra e nome em text-secondary para quem saiu, sem opacidade (que derrubava o texto abaixo de AA).
 * "Eliminou N jogadores" na linha de detalhe quando eliminou alguém (SPEC-20261026-1908, painel e terminal).
 */
export function EliminatedPlayerRow({ entry, onOpen, prizeText, showDue = false, knockout = 'None' }: EliminatedPlayerRowProps) {
  const active = isActiveStatus(entry.status)
  const hasBounty =
    knockout !== 'None' && ((entry.bountyWon ?? 0) > 0 || (knockout === 'Progressive' && !entry.eliminatedAt && (entry.bountyHead ?? 0) > 0))
  const hasDetail = !!prizeText || showDue || (entry.eliminationsCount ?? 0) > 0 || hasBounty
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex min-h-[48px] w-full min-w-0 items-center gap-2 rounded-lg border border-border-default p-2 text-left',
        active ? 'bg-bg-secondary' : 'bg-bg-zebra',
      )}
      data-eliminated-row
    >
      <Avatar src={entry.person.photoUrl} name={entry.person.fullName} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-sm', active ? 'font-medium text-text-primary' : 'text-text-secondary')}>
          {playerName(entry)}
        </span>
        {hasDetail && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs">
            {prizeText && <span className="font-semibold tabular-nums text-accent-gold-deep">{prizeText}</span>}
            {showDue && <DueLabel entry={entry} />}
            <EliminationsLabel entry={entry} />
            <BountyLabel entry={entry} knockout={knockout} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs text-text-secondary">{statusLabel(entry)}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
    </button>
  )
}
