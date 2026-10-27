import { ChevronRight } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { requiredPlanFor } from '../../../components/plan/planUtils'
import { usePlanCatalog } from '../../../hooks/usePlanCatalog'
import { MANUAL_INDEX, MANUAL_MODULES, MANUAL_PAGE, countSteps, manualHref } from '../manual.content'
import { ManualHelp } from './ManualHelp'
import { ManualIcon } from './ManualIcon'

/**
 * Índice do manual em `/manual` (SPEC-20261026-1910): um card por módulo (ícone, título, resumo, passos e o selo do
 * plano quando o módulo inteiro é recurso pago) e o contato do suporte. `notFound`: chegou por um endereço de módulo
 * que não existe — mostra o aviso e o índice.
 */
export function ManualIndex({ notFound = false }: { notFound?: boolean }) {
  const { plans } = usePlanCatalog()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12 lg:px-8">
      {notFound && (
        <div role="alert" className="mb-8 rounded-2xl border border-accent-gold bg-accent-gold-soft p-4 sm:p-5" data-manual-not-found>
          <h2 className="text-lg font-extrabold text-text-primary">{MANUAL_PAGE.notFoundTitle}</h2>
          <p className="mt-1 text-base text-text-primary">{MANUAL_PAGE.notFoundText}</p>
        </div>
      )}
      <h1 className="text-3xl font-black text-text-primary sm:text-4xl">{MANUAL_INDEX.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">{MANUAL_INDEX.text}</p>

      <nav aria-label={MANUAL_INDEX.modulesLabel} className="mt-8">
        <ol className="grid gap-4 md:grid-cols-2">
          {MANUAL_MODULES.map((module, index) => {
            const plan = 'feature' in module && module.feature ? requiredPlanFor(module.feature, plans) : null
            return (
              <li key={module.slug}>
                <a
                  href={manualHref(module.slug)}
                  className="group flex h-full gap-4 rounded-2xl border border-border-default bg-bg-card p-4 shadow-sm transition-colors hover:border-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue sm:p-5"
                  data-manual-module={module.slug}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-blue-soft text-accent-blue">
                    <ManualIcon icon={module.icon} className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-text-secondary tabular-nums">
                      {`${index + 1} · ${MANUAL_INDEX.stepsLabel(countSteps(module))}`}
                    </span>
                    <span className="mt-1 block text-lg font-extrabold leading-snug text-text-primary group-hover:text-accent-blue">
                      {module.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-text-secondary">{module.summary}</span>
                    {plan && (
                      <Badge color="gold" className="mt-2">
                        {`${MANUAL_PAGE.planPrefix} ${plan}`}
                      </Badge>
                    )}
                  </span>
                  <ChevronRight className="mt-3 h-5 w-5 shrink-0 text-text-muted group-hover:text-accent-blue" aria-hidden="true" />
                </a>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="mt-10">
        <ManualHelp />
      </div>
    </div>
  )
}
