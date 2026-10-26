import { useNavigate } from 'react-router-dom'
import { Lock, Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { useAuth } from '../../hooks/useAuth'
import { nextTournamentAllowedAt, usePlan } from '../../hooks/usePlan'
import { usePlanGate } from '../../hooks/usePlanGate'
import { useTimeUntil } from '../plan'

interface NewTournamentButtonProps {
  homeGameId: string
  /** Dono do home game: a contagem regressiva só vale para ele (o limite é do plano do dono) */
  ownerId: string | null | undefined
  homeGameName?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * "Novo Torneio" com o limite semanal do plano (SPEC-20261023-1205, §3.3).
 *
 * Quando o usuário logado é o DONO e o `GET me/plan` diz que a vaga da semana está ocupada
 * (`usage.tournamentsLast7Days.nextAllowedAt` no futuro), o botão fica desabilitado com
 * "Próximo libera em X" (contagem regressiva) e o link "Ver planos" abre o UpgradeModal.
 * Membros que não são donos não têm pré-bloqueio (o uso é do dono): se o backend recusar na criação, o 402 abre o
 * mesmo modal sozinho. O Admin do sistema é tratado como qualquer conta (SPEC-20261026-1126).
 */
export function NewTournamentButton({
  homeGameId,
  ownerId,
  homeGameName,
  size = 'md',
  className,
}: NewTournamentButtonProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { myPlan } = usePlan()
  const gate = usePlanGate()

  const isOwner = !!user?.id && !!ownerId && ownerId === user.id
  const nextAllowedAt = isOwner ? nextTournamentAllowedAt(myPlan) : null
  const { label, reached } = useTimeUntil(nextAllowedAt)
  const blocked = !!nextAllowedAt && !reached && !!label

  if (blocked && myPlan) {
    const weekly = myPlan.usage.tournamentsLast7Days
    return (
      <div className={cn('flex flex-col items-stretch gap-1 sm:items-end', className)}>
        {/* Desabilitado sem opacity (o texto da contagem precisa continuar legível): fundo e texto
            de "inativo" pelos tokens */}
        <Button
          size={size}
          variant="secondary"
          disabled
          className="bg-bg-tertiary text-text-secondary disabled:opacity-100"
          title="O plano atual permite um número limitado de torneios a cada 7 dias"
        >
          <Lock className="h-4 w-4 text-accent-gold-deep" />
          Próximo libera em {label}
        </Button>
        <button
          type="button"
          onClick={() =>
            gate.open({
              code: 'tournaments_per_week',
              currentPlan: myPlan.effectivePlan,
              usage: weekly.used,
              limit: weekly.limit,
              nextAllowedAt,
              homeGameName: homeGameName ?? null,
            })
          }
          className="min-h-[32px] text-sm font-medium text-accent-blue hover:underline"
        >
          Ver planos
        </button>
      </div>
    )
  }

  return (
    <Button
      size={size}
      className={className}
      onClick={() => navigate(`/home-games/${homeGameId}/tournaments/new`)}
    >
      <Plus className="h-4 w-4" />
      Novo Torneio
    </Button>
  )
}
