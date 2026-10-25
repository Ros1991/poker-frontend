import { Fragment, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, Share2, Trophy } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { FINAL_TABLE_SIZE } from '../../constants/ranking'
import { publicRankingPath, publicRankingPlayerPath } from '../../constants/routes'
import { useCanonical } from '../../hooks/usePageMeta'
import type { PublicRankingPlayer } from '../../types/publicRanking.types'
import { cn } from '../../utils/cn'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { PublicClubLogo, PublicLoading, PublicMessage, PublicShell } from './PublicLayout'
import {
  focusRingClass,
  formatCurrency,
  formatPoints,
  formatTime,
  plural,
  pointsRule,
  positionTone,
  publicButtonClass,
  scoringRule,
  shareLink,
  stagesSummary,
  usePublicRanking,
} from './publicRanking.utils'

export function PublicRankingPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: ranking, isLoading, isFetching, notFound, refetch } = usePublicRanking(slug)

  useEffect(() => {
    if (ranking) document.title = `${ranking.name} · Ranking`
  }, [ranking])
  // Canonical do próprio ranking (o do index.html é o da raiz) — SPEC-20261023-1207
  useCanonical(ranking ? publicRankingPath(ranking.slug) : null)

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

  const showFinalTable = ranking.leaderboard.length > FINAL_TABLE_SIZE

  return (
    <PublicShell branding={ranking}>
      <header className="mb-5 flex items-start gap-3">
        <PublicClubLogo branding={ranking} alt={ranking.homeGameName} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-blue">
            {ranking.homeGameName}
          </p>
          <h1 className="mt-1.5 text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-text-primary">
            {ranking.name}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{stagesSummary(ranking)}</p>
        </div>
        <button
          type="button"
          onClick={() => void shareLink(ranking.name, window.location.href)}
          className={cn(
            '-mr-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary',
            focusRingClass,
          )}
          aria-label="Compartilhar ranking"
        >
          <Share2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {ranking.accumulatedPrize > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-accent-green/30 bg-accent-green-soft px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-green/15">
            <Trophy className="h-5 w-5 text-accent-green-deep" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-wider text-accent-green-deep">
              Prêmio acumulado
            </span>
            <span className="block text-xl font-bold tabular-nums text-accent-green-deep">
              {formatCurrency(ranking.accumulatedPrize)}
            </span>
          </span>
        </div>
      )}

      {ranking.leaderboard.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-bg-card px-6 py-12 text-center">
          <Trophy className="mx-auto mb-3 h-10 w-10 text-text-muted" aria-hidden="true" />
          <p className="font-semibold text-text-primary">Nenhuma etapa finalizada ainda</p>
          <p className="mt-1 text-sm text-text-secondary">
            A classificação aparece aqui quando o primeiro torneio terminar.
          </p>
        </div>
      ) : (
        <ol
          aria-label="Classificação"
          className="flex flex-col gap-0.5 rounded-2xl border border-border-default bg-bg-card p-1.5"
        >
          {ranking.leaderboard.map((player) => (
            <Fragment key={player.personId}>
              <li>
                <PlayerRow
                  player={player}
                  slug={ranking.slug}
                  dimmed={showFinalTable && player.position > FINAL_TABLE_SIZE}
                />
              </li>
              {showFinalTable && player.position === FINAL_TABLE_SIZE && (
                <li
                  aria-hidden="true"
                  className="flex items-center gap-3 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-accent-gold-deep"
                >
                  <span className="h-px flex-1 bg-accent-gold/40" />
                  Mesa final · top {FINAL_TABLE_SIZE}
                  <span className="h-px flex-1 bg-accent-gold/40" />
                </li>
              )}
            </Fragment>
          ))}
        </ol>
      )}

      <section className="mt-6 rounded-2xl border border-border-default bg-bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Como funciona
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          {pointsRule(ranking)} {scoringRule(ranking)}
          {ranking.leaderboard.length > 0 && ' Toque em um jogador para ver etapa por etapa.'}
        </p>
      </section>

      <p className="mt-4 text-center text-xs tabular-nums text-text-secondary">
        Atualizado às {formatTime(ranking.generatedAt)}
      </p>
    </PublicShell>
  )
}

interface PlayerRowProps {
  player: PublicRankingPlayer
  slug: string
  dimmed: boolean
}

function PlayerRow({ player, slug, dimmed }: PlayerRowProps) {
  const tone = positionTone(player.position)
  return (
    <Link
      to={publicRankingPlayerPath(slug, player.personId)}
      aria-label={`${player.position}º ${player.displayName}, ${formatPoints(player.totalPoints)} pontos`}
      className={cn(
        'flex min-h-16 items-center gap-3 rounded-xl border px-2.5 py-2 transition',
        focusRingClass,
        // relative + z-10 no foco: o anel não fica por baixo do fundo da linha seguinte
        'focus-visible:relative focus-visible:z-10',
        // Pódio mantém o fundo pastel da medalha e escurece por filtro no hover/toque (a 0.92 o pior
        // texto da linha — gold-deep e text-secondary sobre o pastel — ainda dá 4.53:1); as outras
        // linhas ganham o fundo bg-tertiary e escurecem um pouco mais no toque.
        tone.row
          ? cn(tone.row, 'hover:brightness-95 active:brightness-[0.92]')
          : 'border-transparent hover:bg-bg-tertiary active:bg-bg-tertiary active:brightness-95',
      )}
    >
      <span className={cn('w-7 shrink-0 text-center text-lg font-bold tabular-nums', tone.text)}>
        {player.position}
      </span>
      <Avatar src={resolveMediaUrl(player.photoUrl)} name={player.displayName} size="md" />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate font-semibold',
            dimmed ? 'text-text-secondary' : 'text-text-primary',
          )}
        >
          {player.displayName}
        </span>
        <span className="block text-xs tabular-nums text-text-secondary">
          {plural(player.tournamentsPlayed, 'etapa', 'etapas')}
          {player.bestPosition != null && ` · melhor ${player.bestPosition}º`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-lg font-bold leading-none tabular-nums text-text-primary">
          {formatPoints(player.totalPoints)}
        </span>
        <span className="mt-1 block text-[11px] uppercase tracking-wider text-text-secondary">pts</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
    </Link>
  )
}
