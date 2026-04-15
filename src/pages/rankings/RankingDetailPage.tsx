import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Trophy, Edit } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { rankingEditPath } from '../../constants/routes'
import * as rankingsApi from '../../api/rankings.api'
import * as homeGamesApi from '../../api/homeGames.api'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { useAuth } from '../../hooks/useAuth'

function evaluateFormula(
  formula: string,
  posicao: number,
  jogadores: number,
): number | null {
  try {
    const fn = new Function('posicao', 'jogadores', `return ${formula}`)
    const result = fn(posicao, jogadores) as unknown
    return typeof result === 'number' && isFinite(result)
      ? Math.round((result as number) * 100) / 100
      : null
  } catch {
    return null
  }
}

function positionColor(position: number): string {
  if (position === 1) return 'text-yellow-400'
  if (position === 2) return 'text-gray-300'
  if (position === 3) return 'text-orange-400'
  return 'text-text-secondary'
}

function positionBg(position: number): string {
  if (position === 1) return 'bg-yellow-500/10'
  if (position === 2) return 'bg-gray-400/10'
  if (position === 3) return 'bg-orange-500/10'
  return ''
}

export function RankingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const {
    data: ranking,
    isLoading: rankingLoading,
  } = useQuery({
    queryKey: ['ranking', id],
    queryFn: () => rankingsApi.getById(id!),
    enabled: !!id,
  })

  const { data: homeGame } = useQuery({
    queryKey: ['homeGame', ranking?.homeGameId],
    queryFn: () => homeGamesApi.getById(ranking!.homeGameId),
    enabled: !!ranking?.homeGameId,
  })

  const { data: members } = useQuery({
    queryKey: ['homeGameMembers', ranking?.homeGameId],
    queryFn: () => homeGamesApi.getMembers(ranking!.homeGameId),
    enabled: !!ranking?.homeGameId,
  })

  const canManage =
    user?.role === 'Admin' ||
    homeGame?.ownerId === user?.id ||
    (members ?? []).some((m) => m.userId === user?.id && m.isAdmin)

  const {
    data: leaderboard,
    isLoading: leaderboardLoading,
  } = useQuery({
    queryKey: ['ranking-leaderboard', id],
    queryFn: () => rankingsApi.getLeaderboard(id!),
    enabled: !!id,
  })

  const isLoading = rankingLoading || leaderboardLoading

  const formulaPreview = useMemo(() => {
    if (!ranking?.scoringFormula) return []
    const rows: { position: number; points: number | null }[] = []
    const playerCount = 20
    for (let i = 1; i <= 10; i++) {
      rows.push({
        position: i,
        points: evaluateFormula(ranking.scoringFormula, i, playerCount),
      })
    }
    return rows
  }, [ranking?.scoringFormula])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando leaderboard..." />
      </div>
    )
  }

  if (!ranking) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-accent-red">Ranking nao encontrado.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
            <Trophy className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">
              {ranking.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {ranking.season && (
                <span className="text-sm text-text-secondary">
                  {ranking.season}
                </span>
              )}
              <Badge color={ranking.isActive ? 'green' : 'gray'}>
                {ranking.isActive ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
          {canManage && (
            <Button variant="secondary" onClick={() => navigate(rankingEditPath(ranking.id))}>
              <Edit className="h-4 w-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}
        </div>
        {ranking.description && (
          <p className="text-sm text-text-secondary mt-2">
            {ranking.description}
          </p>
        )}
        {ranking.accumulatedPrize > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent-green/10 px-4 py-2">
            <span className="text-sm font-medium text-accent-green">
              Premio acumulado: R$ {ranking.accumulatedPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>

      {leaderboard && leaderboard.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-text-muted">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
          <span>Top 9 — classificados para a Mesa Final</span>
        </div>
      )}

      {!leaderboard || leaderboard.length === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary py-16">
            <Trophy className="h-12 w-12 text-text-muted mb-4" />
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Nenhum torneio computado ainda
            </h2>
            <p className="text-sm text-text-secondary">
              Os resultados aparecerão aqui apos a conclusao dos torneios.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-bg-tertiary/50">
                  <th className="px-4 py-3 text-left font-medium text-text-muted w-16">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-muted">
                    Jogador
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted">
                    Pontos
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted hidden sm:table-cell">
                    Torneios
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted hidden md:table-cell">
                    Melhor Pos.
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted hidden md:table-cell">
                    Descartados
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-muted hidden md:table-cell">
                    Media/Torneio
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => (
                  <tr
                    key={entry.person.id}
                    className={`border-b last:border-0 ${positionBg(entry.position)} ${
                      entry.position <= 9
                        ? 'border-border-default'
                        : 'border-border-default opacity-60'
                    } ${entry.position === 9 ? 'border-b-2 border-b-yellow-500/50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-base font-bold ${positionColor(entry.position)}`}
                        >
                          {entry.position}
                        </span>
                        {entry.position <= 9 && (
                          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" title="Mesa Final" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={entry.person.photoUrl}
                          name={entry.person.nickname ?? entry.person.fullName}
                          size="sm"
                        />
                        <span className="font-medium text-text-primary">
                          {entry.person.nickname ?? entry.person.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-text-primary">
                        {entry.totalPoints}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary hidden sm:table-cell">
                      {entry.tournamentsPlayed}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary hidden md:table-cell">
                      {entry.bestPosition}o
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary hidden md:table-cell">
                      {entry.discardedPoints > 0 ? (
                        <span className="text-accent-red">-{entry.discardedPoints}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary hidden md:table-cell">
                      {entry.averagePoints.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
