import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, Share2 } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { publicRankingPath, publicRankingPlayerPath } from '../../constants/routes'
import { useCanonical } from '../../hooks/usePageMeta'
import { cn } from '../../utils/cn'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { PublicLoading, PublicMessage, PublicShell } from './PublicLayout'
import {
  buildPlayerRows,
  focusRingClass,
  formatPoints,
  formatShortDate,
  formatTime,
  playerExplanation,
  positionTone,
  publicButtonClass,
  shareLink,
  stageStatus,
  usePublicRanking,
} from './publicRanking.utils'
import type { PlayerStageRow, StageStatus } from './publicRanking.utils'

type SortBy = 'date' | 'points'

export function PublicPlayerPage() {
  const { slug, personId } = useParams<{ slug: string; personId: string }>()
  const { data: ranking, isLoading, isFetching, notFound, refetch } = usePublicRanking(slug)
  const [sortBy, setSortBy] = useState<SortBy>('date')

  const player = ranking?.leaderboard.find((p) => p.personId === personId)

  // Vindo da lista, a página nova começa no topo
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [personId])

  useEffect(() => {
    if (ranking && player) document.title = `${player.displayName} · ${ranking.name}`
  }, [ranking, player])
  // Canonical da própria página do jogador (o do index.html é o da raiz) — SPEC-20261023-1207
  useCanonical(ranking && player ? publicRankingPlayerPath(ranking.slug, player.personId) : null)

  if (isLoading) return <PublicLoading />

  if (notFound) {
    return (
      <PublicMessage
        variant="not-found"
        title="Ranking não encontrado"
        description="Confira se o endereço está completo. Ele pode ter sido digitado errado, ou o ranking foi removido."
      />
    )
  }

  // Sem dados: erro de verdade. Com dados em cache, uma falha de refetch em
  // segundo plano (rede ruim, redeploy) não pode apagar a classificação da tela.
  if (!ranking) {
    return (
      <PublicMessage
        variant="error"
        title="Não foi possível carregar o ranking"
        description="Verifique sua conexão e tente de novo."
        action={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className={publicButtonClass}
          >
            {isFetching ? 'Carregando…' : 'Tentar de novo'}
          </button>
        }
      />
    )
  }

  if (!player) {
    return (
      <PublicMessage
        variant="not-found"
        title="Jogador não encontrado"
        description="Este jogador não tem resultados neste ranking."
        action={
          <Link to={publicRankingPath(ranking.slug)} className={publicButtonClass}>
            Ver classificação
          </Link>
        }
      />
    )
  }

  const tone = positionTone(player.position)
  const rows = buildPlayerRows(ranking, player, sortBy)

  return (
    <PublicShell branding={ranking}>
      <nav className="-mx-2 mb-3 flex items-center justify-between gap-2">
        <Link
          to={publicRankingPath(ranking.slug)}
          className={cn(
            'inline-flex min-h-11 min-w-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary',
            focusRingClass,
          )}
        >
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{ranking.name}</span>
        </Link>
        <button
          type="button"
          onClick={() =>
            void shareLink(`${player.displayName} · ${ranking.name}`, window.location.href)
          }
          className={cn(
            'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary',
            focusRingClass,
          )}
          aria-label="Compartilhar resumo"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>

      <section className="rounded-2xl border border-border-default bg-bg-card p-4">
        <div className="flex items-center gap-4">
          <Avatar src={resolveMediaUrl(player.photoUrl)} name={player.displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-text-primary">
              {player.displayName}
            </h1>
            <p className="mt-0.5 text-sm tabular-nums text-text-secondary">
              <span className={cn('font-semibold', tone.text)}>{player.position}º lugar</span>{' '}
              de {ranking.leaderboard.length}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Pontos" value={formatPoints(player.totalPoints)} emphasis />
          <Stat label="Etapas" value={`${player.tournamentsPlayed}/${ranking.totalStages}`} />
          <Stat
            label="Melhor"
            value={player.bestPosition != null ? `${player.bestPosition}º` : '—'}
          />
        </dl>

        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          {playerExplanation(ranking, player)}
        </p>
      </section>

      <div className="mb-2 mt-6 flex items-center justify-between gap-3 pl-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Etapa por etapa
        </h2>
        <div
          role="group"
          aria-label="Ordenar etapas"
          className="inline-flex rounded-lg border border-border-input bg-bg-card p-0.5"
        >
          <SortButton active={sortBy === 'date'} onClick={() => setSortBy('date')}>
            Data
          </SortButton>
          <SortButton active={sortBy === 'points'} onClick={() => setSortBy('points')}>
            Pontos
          </SortButton>
        </div>
      </div>

      <ol className="flex flex-col gap-0.5 rounded-2xl border border-border-default bg-bg-card p-1.5">
        {rows.map((row) => (
          <li key={row.key}>
            <StageRow row={row} />
          </li>
        ))}
      </ol>

      <p className="mt-4 text-center text-xs tabular-nums text-text-secondary">
        Atualizado às {formatTime(ranking.generatedAt)}
      </p>
    </PublicShell>
  )
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl bg-bg-tertiary px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 text-lg font-bold tabular-nums',
          emphasis ? 'text-accent-blue' : 'text-text-primary',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-11 rounded-md px-3.5 text-sm font-medium transition-colors',
        focusRingClass,
        active ? 'bg-accent-blue-soft text-accent-blue' : 'text-text-secondary hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

// Chip da etapa: contou = verde (soft + deep), descartada = neutra, falta = vermelho tracejado
const STATUS_PILL: Record<StageStatus, { label: string; className: string }> = {
  counted: { label: 'Contou', className: 'bg-accent-green-soft text-accent-green-deep' },
  discarded: { label: 'Descartado', className: 'bg-bg-tertiary text-text-secondary' },
  absent: { label: 'Falta', className: 'border border-dashed border-accent-red/40 text-accent-red-deep' },
}

function StageRow({ row }: { row: PlayerStageRow }) {
  const { stage, result } = row
  const status = stageStatus(row)
  const pill = STATUS_PILL[status]
  const podiumText = result && result.position <= 3 ? positionTone(result.position).text : 'text-text-secondary'

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-xl px-2.5 py-2">
      <span className="w-10 shrink-0 text-xs font-medium tabular-nums text-text-secondary">
        {formatShortDate(stage.date)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-sm font-medium',
            result ? 'text-text-primary' : 'text-text-secondary',
          )}
        >
          {stage.name}
        </span>
        <span className={cn('block text-xs tabular-nums', result ? podiumText : 'text-text-secondary')}>
          {result ? `${result.position}º de ${stage.playerCount}` : 'Não jogou'}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'text-base font-bold leading-none tabular-nums',
            status === 'counted' && 'text-text-primary',
            // descartada: apagada e riscada; a linha mais escura que o dígito, senão some dentro do número
            status === 'discarded' && 'text-text-muted line-through decoration-text-secondary decoration-2',
            // falta: o "0" é lido (não é riscado) — text-secondary, não text-muted
            status === 'absent' && 'text-text-secondary',
          )}
        >
          {result ? formatPoints(result.points) : '0'}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight',
            pill.className,
          )}
        >
          {pill.label}
        </span>
      </span>
    </div>
  )
}
