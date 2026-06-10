import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trophy, Calendar, Hash } from 'lucide-react'
import * as rankingsApi from '../../api/rankings.api'
import * as homeGamesApi from '../../api/homeGames.api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'

export function RankingListPage() {
  const { homeGameId } = useParams<{ homeGameId: string }>()
  const navigate = useNavigate()

  const {
    data: rankings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['rankings', homeGameId],
    queryFn: () => rankingsApi.getAll(homeGameId!),
    enabled: !!homeGameId,
  })

  const { data: homeGame } = useQuery({
    queryKey: ['homeGame', homeGameId],
    queryFn: () => homeGamesApi.getById(homeGameId!),
    enabled: !!homeGameId,
  })

  if (!homeGameId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Trophy className="h-12 w-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Selecione um Home Game
        </h2>
        <p className="text-sm text-text-secondary">
          Acesse os rankings a partir de um Home Game.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Carregando rankings..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-accent-red">
          Erro ao carregar rankings. Tente novamente.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Rankings</h1>
          {homeGame && (
            <p className="text-sm text-text-secondary mt-1">
              {homeGame.name}
            </p>
          )}
        </div>
        <Button
          onClick={() =>
            navigate(`/home-games/${homeGameId}/rankings/new`)
          }
        >
          <Plus className="h-4 w-4" />
          Novo Ranking
        </Button>
      </div>

      {!rankings || rankings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary py-16">
          <Trophy className="h-12 w-12 text-text-muted mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Nenhum ranking criado
          </h2>
          <p className="text-sm text-text-secondary mb-6">
            Crie o primeiro ranking para este Home Game.
          </p>
          <Button
            onClick={() =>
              navigate(`/home-games/${homeGameId}/rankings/new`)
            }
          >
            <Plus className="h-4 w-4" />
            Criar Ranking
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rankings.map((ranking) => (
            <Link
              key={ranking.id}
              to={`/rankings/${ranking.id}`}
              className="group rounded-xl border border-border-default bg-bg-secondary p-5 transition-colors hover:border-accent-blue/50 hover:bg-bg-tertiary"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
                    <Trophy className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary group-hover:text-accent-blue transition-colors">
                      {ranking.name}
                    </h3>
                    {ranking.season && (
                      <p className="text-xs text-text-muted">
                        {ranking.season}
                      </p>
                    )}
                  </div>
                </div>
                <Badge color={ranking.isActive ? 'green' : 'gray'}>
                  {ranking.isActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>

              {ranking.description && (
                <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                  {ranking.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-text-muted">
                {ranking.season && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {ranking.season}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  {ranking.scoringMode === 'Formula' ? 'Formula' : 'Por posicao'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
