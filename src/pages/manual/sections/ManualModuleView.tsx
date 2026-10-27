import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { requiredPlanFor } from '../../../components/plan/planUtils'
import { usePlanCatalog } from '../../../hooks/usePlanCatalog'
import type { PlanFeature } from '../../../types/plan.types'
import { MANUAL_MODULES, MANUAL_PAGE, manualHref } from '../manual.content'
import type { ManualModule } from '../manual.content'
import { ManualHelp } from './ManualHelp'
import { ManualIcon } from './ManualIcon'
import { ManualPlans } from './ManualPlans'
import { ManualStepItem } from './ManualStepItem'

const NAV_LINK =
  'flex min-h-[64px] items-center gap-3 rounded-2xl border border-border-default bg-bg-card p-4 shadow-sm hover:border-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue'

/**
 * Um módulo do manual em `/manual/<módulo>` (SPEC-20261026-1910): volta ao índice, título, abertura, "Nesta página"
 * (seções), os passos numerados em sequência (contínua entre as seções), a tabela dos planos no módulo "Planos",
 * anterior/próximo e o contato do suporte. Mobile-first: uma coluna até `md`.
 */
export function ManualModuleView({ module }: { module: ManualModule }) {
  const { plans } = usePlanCatalog()
  const planFor = (feature?: PlanFeature) => (feature ? requiredPlanFor(feature, plans) : null)
  const modulePlan = planFor(module.feature)
  const index = MANUAL_MODULES.findIndex((m) => m.slug === module.slug)
  const previous = index > 0 ? MANUAL_MODULES[index - 1] : null
  const next = index >= 0 && index < MANUAL_MODULES.length - 1 ? MANUAL_MODULES[index + 1] : null
  // Numeração contínua entre as seções: a seção i começa depois dos passos das anteriores
  const firstNumber = module.sections.map((_, i) => module.sections.slice(0, i).reduce((n, s) => n + s.steps.length, 0) + 1)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 lg:px-8">
      <a
        href={manualHref()}
        aria-label={MANUAL_PAGE.backToIndexLabel}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-sm text-sm font-semibold text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {MANUAL_PAGE.backToIndex}
      </a>

      <header className="mt-3 flex items-start gap-4">
        <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-blue-soft text-accent-blue sm:flex">
          <ManualIcon icon={module.icon} className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl font-black leading-tight text-text-primary sm:text-4xl">{module.title}</h1>
          {modulePlan && (
            <Badge color="gold" className="mt-2">
              {`${MANUAL_PAGE.planPrefix} ${modulePlan}`}
            </Badge>
          )}
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">{module.intro}</p>
        </div>
      </header>

      {(module.sections.length > 1 || module.showPlans) && (
        <nav aria-label={MANUAL_PAGE.summaryLabel} className="mt-6 rounded-2xl border border-border-default bg-bg-card p-4 sm:p-5" data-manual-toc>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">{MANUAL_PAGE.summaryLabel}</p>
          <ol className="mt-2 flex flex-wrap gap-2">
            {module.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-border-default bg-bg-primary px-4 text-sm font-semibold text-text-primary hover:border-accent-blue hover:text-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                >
                  {section.title}
                </a>
              </li>
            ))}
            {module.showPlans && (
              <li>
                <a
                  href="#comparar-planos"
                  className="inline-flex min-h-[44px] items-center rounded-full border border-border-default bg-bg-primary px-4 text-sm font-semibold text-text-primary hover:border-accent-blue hover:text-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                >
                  {MANUAL_PAGE.plansTitle}
                </a>
              </li>
            )}
          </ol>
        </nav>
      )}

      <div className="mt-8 space-y-10">
        {module.sections.map((section, sectionIndex) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-titulo`} className="scroll-mt-4">
            <h2 id={`${section.id}-titulo`} className="text-2xl font-extrabold text-text-primary">
              {section.title}
            </h2>
            <ol className="mt-4 space-y-4">
              {section.steps.map((step, i) => (
                <ManualStepItem
                  key={step.title}
                  step={step}
                  number={firstNumber[sectionIndex] + i}
                  id={`${section.id}-${firstNumber[sectionIndex] + i}`}
                  plan={modulePlan ? null : planFor(step.feature)}
                />
              ))}
            </ol>
          </section>
        ))}

        {module.showPlans && <ManualPlans />}
      </div>

      {(previous || next) && (
        <nav aria-label={MANUAL_PAGE.otherModulesLabel} className="mt-10 grid gap-3 sm:grid-cols-2">
          {previous ? (
            <a href={manualHref(previous.slug)} className={NAV_LINK} data-manual-previous>
              <ChevronLeft className="h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">{MANUAL_PAGE.previous}</span>
                <span className="block font-bold text-text-primary">{previous.title}</span>
              </span>
            </a>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <a href={manualHref(next.slug)} className={`${NAV_LINK} sm:justify-end sm:text-right`} data-manual-next>
              <span className="min-w-0">
                <span className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">{MANUAL_PAGE.next}</span>
                <span className="block font-bold text-text-primary">{next.title}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-accent-blue" aria-hidden="true" />
            </a>
          )}
        </nav>
      )}

      <div className="mt-10">
        <ManualHelp />
      </div>
    </div>
  )
}
