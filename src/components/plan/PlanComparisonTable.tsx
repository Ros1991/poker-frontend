/**
 * Tabela comparativa Mesa / Clube / Liga (SPEC-20261023-1205). Reutilizada pela página "Meu plano",
 * pela landing (SPEC-20261023-1207) e pelas boas-vindas (SPEC-20261023-1212).
 *
 * API estável:
 * ```tsx
 * <PlanComparisonTable
 *   highlightCurrent?="Clube"            // nome do plano a marcar como "Seu plano"
 *   onChoose?={(plan) => ...}            // mostra um botão por plano; recebe a PlanDefinition
 *   plans?={myPlan.catalog}              // catálogo já em mãos; sem isto busca GET public/plans
 *   chooseLabel?={(plan, isCurrent) => 'Começar grátis'}  // texto do botão (default abaixo)
 *   showTestPhaseNote?={true}            // nota "fase de testes" no rodapé (default true)
 *   className?="..."
 * />
 * ```
 * Preços e limites saem SÓ do catálogo (nada digitado). O plano com `highlight` (Clube) leva o selo
 * "Mais escolhido". Botão default: "Plano atual" (desabilitado) no `highlightCurrent`, "Começar
 * grátis" no plano de preço 0 e "Quero o <nome>" nos pagos.
 */
import type { ReactNode } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../utils/cn'
import { usePlanCatalog } from '../../hooks/usePlanCatalog'
import type { PlanDefinition, PlanFeature } from '../../types/plan.types'
import {
  PLAN_FEATURE_LABELS,
  PLAN_TAGLINES,
  describeHomeGames,
  describeMembers,
  describeTournaments,
  describeTv,
  formatPlanPrice,
  formatYearlyPrice,
  planIncludes,
} from './planUtils'

/** Recursos listados linha a linha (a logo do clube no telão entra na linha do telão). */
const FEATURE_ROWS: PlanFeature[] = [
  'Tables',
  'Prizes',
  'Payments',
  'CostExtras',
  'Financial',
  'Rankings',
  'DealerQr',
  'PixCardOnTv',
]

export interface PlanComparisonTableProps {
  highlightCurrent?: string
  onChoose?: (plan: PlanDefinition) => void
  plans?: PlanDefinition[]
  chooseLabel?: (plan: PlanDefinition, isCurrent: boolean) => string
  showTestPhaseNote?: boolean
  className?: string
}

function defaultChooseLabel(plan: PlanDefinition, isCurrent: boolean) {
  if (isCurrent) return 'Plano atual'
  if (plan.priceMonthly <= 0) return 'Começar grátis'
  return `Quero o ${plan.name}`
}

function Row({ included, children }: { included: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {included ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" aria-hidden />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
      )}
      <span className={included ? 'text-text-primary' : 'text-text-secondary'}>
        {children}
        {!included && <span className="sr-only"> (não incluso)</span>}
      </span>
    </li>
  )
}

export function PlanComparisonTable({
  highlightCurrent,
  onChoose,
  plans: plansProp,
  chooseLabel = defaultChooseLabel,
  showTestPhaseNote = true,
  className,
}: PlanComparisonTableProps) {
  const catalog = usePlanCatalog({ enabled: !plansProp?.length })
  const plans = [...(plansProp?.length ? plansProp : catalog.plans)].sort(
    (a, b) => a.order - b.order,
  )
  const currentOrder = plans.find((p) => p.name === highlightCurrent)?.order

  if (!plans.length) {
    if (catalog.isError) {
      return (
        <div
          className={cn(
            'rounded-lg border border-accent-red/30 bg-accent-red-soft p-6 text-center',
            className,
          )}
        >
          <p className="text-text-primary">Não foi possível carregar os planos.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={catalog.refetch}>
            Tentar de novo
          </Button>
        </div>
      )
    }
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-text-muted" aria-label="Carregando planos" />
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = !!highlightCurrent && plan.name === highlightCurrent
          return (
            <section
              key={plan.name}
              aria-label={`Plano ${plan.name}`}
              className={cn(
                'relative flex flex-col rounded-xl border bg-bg-card p-5 shadow-sm',
                plan.highlight ? 'border-2 border-accent-gold' : 'border-border-default',
                isCurrent && 'ring-2 ring-accent-blue ring-offset-2 ring-offset-bg-primary',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-extrabold text-text-primary">{plan.name}</h3>
                {plan.highlight && <Badge color="gold">Mais escolhido</Badge>}
                {isCurrent && <Badge color="blue">Seu plano</Badge>}
              </div>
              {plan.name in PLAN_TAGLINES && (
                <p className="mt-1 text-sm text-text-secondary">
                  {PLAN_TAGLINES[plan.name]}
                </p>
              )}

              <div className="mt-4">
                <span className="text-3xl font-extrabold text-text-primary tabular-nums">
                  {formatPlanPrice(plan.priceMonthly)}
                </span>
                {plan.priceMonthly > 0 && (
                  <span className="text-sm text-text-secondary">/mês</span>
                )}
                <p className="mt-1 min-h-[1.25rem] text-xs text-text-secondary">
                  {plan.priceYearly > 0
                    ? `ou ${formatYearlyPrice(plan.priceYearly)}/ano quando a cobrança entrar`
                    : 'Sem cartão de crédito'}
                </p>
              </div>

              <ul className="mt-4 space-y-2 border-t border-border-default pt-4 text-sm">
                {/* SPEC-20261029-1723: Mesa e Clube "Um só: a sua conta é o clube"; Liga "Até 3 home games" */}
                <Row included>{describeHomeGames(plan)}</Row>
                <Row included>{describeTournaments(plan)}</Row>
                <Row included={plan.maxMembersPerHomeGame !== 0}>{describeMembers(plan)}</Row>
                <Row included>Relógio de blinds, inscrições, rebuy/add-on e eliminações</Row>
                <Row included>{describeTv(plan)}</Row>
                {FEATURE_ROWS.map((feature) => (
                  <Row key={feature} included={planIncludes(plan, feature)}>
                    {PLAN_FEATURE_LABELS[feature]}
                  </Row>
                ))}
                <Row included>Histórico dos torneios para sempre</Row>
              </ul>

              {onChoose && (
                <div className="mt-5 pt-1 md:mt-auto md:pt-5">
                  <Button
                    className="w-full"
                    variant={
                      isCurrent || (currentOrder !== undefined && plan.order < currentOrder)
                        ? 'secondary'
                        : plan.highlight
                          ? 'gold'
                          : 'primary'
                    }
                    disabled={isCurrent}
                    onClick={() => onChoose(plan)}
                  >
                    {chooseLabel(plan, isCurrent)}
                  </Button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {showTestPhaseNote && (
        <p className="text-center text-xs text-text-secondary">
          Fase de testes: ainda não há cobrança automática. O Clube e a Liga são ativados pelo
          suporte, pelo WhatsApp.
        </p>
      )}
    </div>
  )
}
