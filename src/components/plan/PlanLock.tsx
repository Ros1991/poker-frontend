/**
 * Cadeado de recurso de plano pago (SPEC-20261023-1205).
 *
 * API estável:
 * ```tsx
 * <PlanLock
 *   feature="Tables"                 // PlanFeature (obrigatório)
 *   title?="Controle de mesas"       // default: rótulo do recurso
 *   description?="..."               // default: explicação do recurso + "disponível no plano X"
 *   currentPlan?={tournament.ownerPlan}   // plano efetivo do DONO (vai para o modal)
 *   homeGameName?={tournament.homeGameName} // entra na mensagem pronta do WhatsApp
 *   className?="..."
 * >
 *   {children?}  // prévia de exemplo: renderizada desfocada e inerte ATRÁS do cadeado
 * </PlanLock>
 * ```
 * Mostra cadeado + título + explicação + botão "Ver planos", que abre o `UpgradeModal` único
 * (`usePlanGate().openFeature`). Sem `children` é um cartão; com `children` (ex.: leaderboard de
 * exemplo da aba Rankings) o conteúdo fica com `blur-sm`, `aria-hidden` e `inert`, e o cadeado por
 * cima. O plano exigido vem do catálogo (`usePlanCatalog`), nunca digitado.
 */
import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { usePlanGate } from '../../hooks/usePlanGate'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import type { PlanFeature, PlanName } from '../../types/plan.types'
import { PLAN_FEATURE_DESCRIPTIONS, PLAN_FEATURE_LABELS, requiredPlanFor } from './planUtils'

export interface PlanLockProps {
  feature: PlanFeature
  title?: string
  description?: string
  /** Plano efetivo do dono do home game/torneio (repassado ao modal) */
  currentPlan?: PlanName | null
  /** Nome do home game (mensagem pronta do WhatsApp) */
  homeGameName?: string | null
  /** Prévia de exemplo, mostrada desfocada atrás do cadeado */
  children?: ReactNode
  className?: string
}

export function PlanLock({
  feature,
  title,
  description,
  currentPlan,
  homeGameName,
  children,
  className,
}: PlanLockProps) {
  const gate = usePlanGate()
  const { plans } = usePlanCatalog()
  const requiredPlan = requiredPlanFor(feature, plans)
  const heading = title ?? PLAN_FEATURE_LABELS[feature]
  const text =
    description ??
    `${PLAN_FEATURE_DESCRIPTIONS[feature]} Disponível ${
      requiredPlan ? `a partir do plano ${requiredPlan}` : 'nos planos pagos'
    }.`

  const card = (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-border-default bg-bg-card px-6 py-8 text-center shadow-sm',
        !children && className,
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-gold-soft">
        <Lock className="h-6 w-6 text-accent-gold-deep" aria-hidden />
      </div>
      <h3 className="text-lg font-bold text-text-primary">{heading}</h3>
      <p className="text-sm text-text-secondary">{text}</p>
      <Button
        variant="gold"
        onClick={() =>
          gate.openFeature(feature, {
            currentPlan: currentPlan ?? null,
            requiredPlan,
            homeGameName: homeGameName ?? null,
          })
        }
      >
        Ver planos
      </Button>
    </div>
  )

  if (!children) return card

  return (
    <div className={cn('relative min-h-80', className)}>
      <div className="pointer-events-none select-none blur-sm" aria-hidden inert>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">{card}</div>
    </div>
  )
}
