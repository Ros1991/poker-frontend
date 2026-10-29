import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Trophy } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { myTournamentLivePath } from '../../constants/routes'
import { cn } from '../../utils/cn'
import { DUE_TONE_CLASS, ENTRY_STATUS_SEPARATOR } from '../../utils/entryStatusLine'
import type { MyTournament } from '../../types/mePlayer.types'
import {
  formatTournamentDay,
  numbersParts,
  playerTournamentStatus,
  resultText,
  winningsParts,
} from './myTournamentFormat'

interface MyTournamentRowProps {
  tournament: MyTournament
  /** Mostrar "onde" (o clube ou "Torneios de <organizador>") — no filtro por clube fica repetido */
  showWhere?: boolean
}

/**
 * Uma linha da área do jogador (SPEC-20261029-1726): nome, onde e quando; os números da conta ("2 rebuys · Add-on · Deve
 * R$ 90,00", prêmio, bounties); o status do torneio e o resultado ("Campeão", "3º de 12", "Jogando"). Leva ao torneio
 * (ao vivo ou o resultado). Usada no Início ("Como jogador") e em /meus-torneios.
 */
export function MyTournamentRow({ tournament: t, showWhere = true }: MyTournamentRowProps) {
  const status = playerTournamentStatus(t.status)
  const result = resultText(t)
  const parts = numbersParts(t)
  const winnings = winningsParts(t)
  const champion = t.finalPosition === 1

  return (
    <li>
      <Link
        to={myTournamentLivePath(t.tournamentId)}
        className="flex min-h-[64px] items-start gap-3 px-4 py-3 transition-colors hover:bg-bg-tertiary"
        data-my-tournament={t.tournamentId}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{t.name}</p>
          <p className="mt-0.5 flex min-w-0 items-start gap-1 text-xs text-text-secondary">
            <CalendarDays className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0">
              {showWhere && `${t.homeGameLabel} · `}
              {formatTournamentDay(t.date)}
            </span>
          </p>
          <p className="mt-1 text-xs text-text-secondary" data-my-tournament-numbers>
            {parts.map((p, i) => (
              // Cada pedaço inteiro numa linha ("Deve R$ 50,00" não quebra); a quebra fica nos separadores
              <Fragment key={p.kind}>
                {i > 0 && ENTRY_STATUS_SEPARATOR}
                <span className={cn('whitespace-nowrap', p.tone && DUE_TONE_CLASS[p.tone])}>{p.text}</span>
              </Fragment>
            ))}
            {winnings.map((w) => (
              <Fragment key={w}>
                {ENTRY_STATUS_SEPARATOR}
                <span className="whitespace-nowrap font-semibold text-accent-green-deep">{w}</span>
              </Fragment>
            ))}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge color={status.color}>{status.label}</Badge>
          {result && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-semibold tabular-nums',
                champion ? 'text-accent-gold-deep' : 'text-text-primary',
              )}
              data-my-tournament-result
            >
              {champion && <Trophy className="h-3.5 w-3.5" aria-hidden />}
              {result}
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}
