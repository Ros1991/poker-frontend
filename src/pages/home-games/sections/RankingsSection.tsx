import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Crown, Plus } from 'lucide-react'
import * as rankingsApi from '../../../api/rankings.api'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { rankingDetailPath, rankingNewPath } from '../../../constants/routes'
import { hasFeature } from '../../../hooks/usePlan'
import { RankingLockedPreview } from '../../rankings/RankingLockedPreview'
import { EmptyState, SectionSpinner } from './EmptyState'
import { useHomeGameShell } from './homeGameShell'

/**
 * Seção Rankings (era a aba Rankings; SPEC-20261029-1724). Ranking de temporada é recurso pago (SPEC-20261023-1205): o
 * plano que vale é o do DONO (`homeGame.planFeatures`); sem ele a lista nem é consultada (daria 402) e aparece o exemplo
 * desfocado com o cadeado.
 */
export function RankingsSection() {
  const { homeGame, canManage, label } = useHomeGameShell()
  const navigate = useNavigate()
  const canRankings = hasFeature(homeGame.planFeatures, 'Rankings')

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rankings', homeGame.id],
    queryFn: () => rankingsApi.getAll(homeGame.id),
    enabled: canRankings,
  })

  if (!canRankings) {
    return <RankingLockedPreview currentPlan={homeGame.ownerPlan ?? null} homeGameName={label} />
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => navigate(rankingNewPath(homeGame.id))}>
            <Plus className="h-4 w-4" />
            Novo Ranking
          </Button>
        </div>
      )}

      {isLoading && <SectionSpinner />}

      {!isLoading && (rankings ?? []).length === 0 && (
        <EmptyState
          icon={Crown}
          title="Nenhum ranking encontrado"
          description="Crie um ranking para acompanhar a pontuação dos jogadores."
        />
      )}

      {!isLoading && (rankings ?? []).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(rankings ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(rankingDetailPath(r.id))}
              className="flex flex-col rounded-lg border border-border-default bg-bg-secondary p-4 text-left transition-all hover:border-accent-blue/50 hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-accent-gold-deep" />
                <h4 className="font-medium text-text-primary">{r.name}</h4>
                {r.isActive ? <Badge color="green">Ativo</Badge> : <Badge color="gray">Inativo</Badge>}
              </div>
              {r.description && <p className="mt-2 text-sm text-text-secondary line-clamp-2">{r.description}</p>}
              {r.season && <p className="mt-2 text-xs text-text-secondary">Temporada: {r.season}</p>}
              {r.accumulatedPrize != null && r.accumulatedPrize > 0 && (
                <p className="mt-2 text-sm font-medium text-accent-green-deep tabular-nums">
                  Acumulado: R$ {r.accumulatedPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
