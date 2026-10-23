import { Crown, Trophy } from 'lucide-react'
import { PlanLock, requiredPlanFor } from '../../components/plan'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import type { PlanName } from '../../types/plan.types'

/**
 * Exemplo FIXO de leaderboard (nomes e pontos inventados) mostrado desfocado atrás do cadeado
 * quando o plano do dono não tem Rankings (SPEC-20261023-1205, §3.3). Nada aqui vem da API —
 * a lista de rankings nem é consultada sem a feature (responderia 402).
 */
const SAMPLE_LEADERBOARD = [
  { position: 1, name: 'Rafa', stages: 8, points: 412 },
  { position: 2, name: 'Bruno', stages: 8, points: 377 },
  { position: 3, name: 'Carla', stages: 7, points: 351 },
  { position: 4, name: 'Diego', stages: 8, points: 298 },
  { position: 5, name: 'Léo', stages: 6, points: 264 },
  { position: 6, name: 'Marina', stages: 7, points: 241 },
  { position: 7, name: 'Thiago', stages: 5, points: 198 },
] as const

const PODIUM_TONE: Record<number, string> = {
  1: 'bg-accent-gold-soft text-accent-gold-deep',
  2: 'bg-bg-tertiary text-text-primary',
  3: 'bg-accent-orange-soft text-accent-orange-deep',
}

function SampleLeaderboard() {
  return (
    <div className="rounded-xl border border-border-default bg-bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-5 w-5 text-accent-gold-deep" />
        <h4 className="font-semibold text-text-primary">Ranking da temporada</h4>
        <span className="ml-auto flex items-center gap-1 text-sm font-medium tabular-nums text-accent-green-deep">
          <Trophy className="h-4 w-4" />
          Acumulado R$ 1.250,00
        </span>
      </div>
      <ol className="flex flex-col gap-1">
        {SAMPLE_LEADERBOARD.map((p) => (
          <li
            key={p.position}
            className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-primary px-3 py-2"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                PODIUM_TONE[p.position] ?? 'text-text-secondary'
              }`}
            >
              {p.position}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text-primary">{p.name}</span>
              <span className="block text-xs text-text-secondary">{p.stages} etapas</span>
            </span>
            <span className="text-base font-bold tabular-nums text-text-primary">{p.points} pts</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface RankingLockedPreviewProps {
  /** Plano efetivo do dono do home game (vai para o modal) */
  currentPlan?: PlanName | null
  homeGameName?: string | null
  className?: string
}

/** Aba/página de rankings sem o recurso no plano: leaderboard de exemplo desfocado + cadeado */
export function RankingLockedPreview({ currentPlan, homeGameName, className }: RankingLockedPreviewProps) {
  const { plans } = usePlanCatalog()
  const requiredPlan = requiredPlanFor('Rankings', plans)

  return (
    <PlanLock
      feature="Rankings"
      title={`Ranking de temporada disponível no ${requiredPlan ?? 'plano pago'}`}
      description="Pontuação por etapa, descarte dos piores resultados, prêmio acumulado e uma página pública para mandar no grupo do WhatsApp."
      currentPlan={currentPlan ?? null}
      homeGameName={homeGameName ?? null}
      className={className}
    >
      <SampleLeaderboard />
    </PlanLock>
  )
}
