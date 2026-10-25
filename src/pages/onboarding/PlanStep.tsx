import { ArrowLeft } from 'lucide-react'
import { LoadingSpinner } from '../../components/common/LoadingSpinner'
import { PlanComparisonTable } from '../../components/plan'
import { Button } from '../../components/ui/Button'
import type { PlanName } from '../../types/plan.types'
import { cn } from '../../utils/cn'
import { WELCOME_CHOOSE_LABELS } from './welcomeFlow'

interface PlanStepProps {
  /** Plano efetivo da conta (conta nova = Mesa) */
  currentPlan: PlanName
  /** Plano sendo gravado agora (trava a tabela) */
  saving: PlanName | null
  onChoose: (plan: PlanName) => void
  onBack: () => void
}

/**
 * Etapa 2 das boas-vindas — Escolher plano (SPEC-20261023-1212). A tabela é a MESMA do "Meu plano" e da landing
 * (`PlanComparisonTable`, catálogo de `GET public/plans`: nenhum preço ou limite digitado aqui), com o selo "Mais
 * escolhido" no Clube e a nota da fase de testes. Mesa começa na hora; Clube/Liga registram o pedido e abrem o
 * WhatsApp do suporte. "Decidir depois" segue no Mesa.
 */
export function PlanStep({ currentPlan, saving, onChoose, onBack }: PlanStepProps) {
  const paidCurrent = currentPlan !== 'Mesa' ? currentPlan : undefined
  const busy = saving !== null

  return (
    <section aria-labelledby="boas-vindas-plano-titulo" aria-busy={busy}>
      <div className="text-center">
        <h1 id="boas-vindas-plano-titulo" className="text-2xl font-extrabold text-text-primary">
          Escolha seu plano
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-text-secondary">
          Comece grátis no Mesa e mude quando quiser. No Clube e na Liga, a gente ativa pelo WhatsApp do suporte e
          sua conta segue no Mesa até lá — nada se perde.
        </p>
      </div>

      <div className={cn('mt-6', busy && 'pointer-events-none')}>
        <PlanComparisonTable
          highlightCurrent={paidCurrent}
          onChoose={(plan) => {
            if (!busy) onChoose(plan.name)
          }}
          chooseLabel={(plan, isCurrent) =>
            isCurrent ? 'Plano atual' : saving === plan.name ? 'Salvando…' : WELCOME_CHOOSE_LABELS[plan.name]
          }
        />
      </div>

      {busy && (
        <div className="mt-4 flex justify-center" role="status">
          <LoadingSpinner size="sm" text="Salvando sua escolha…" />
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar aos seus dados
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onChoose('Mesa')}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          Decidir depois e continuar no Mesa
        </Button>
      </div>
    </section>
  )
}
