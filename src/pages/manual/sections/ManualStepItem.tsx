import { ArrowRight, Lightbulb } from 'lucide-react'
import { Badge } from '../../../components/ui/Badge'
import { cn } from '../../../utils/cn'
import { MANUAL_PAGE, manualHref } from '../manual.content'
import type { ManualStep } from '../manual.content'
import { MANUAL_IMAGES } from '../manualImages'
import { ManualFigure } from './ManualFigure'

interface ManualStepItemProps {
  step: ManualStep
  /** Número do passo no módulo (contínuo entre as seções) */
  number: number
  /** Âncora do passo */
  id: string
  /** Nome do plano que libera o recurso do passo (selo "A partir do Clube"), ou null */
  plan: string | null
}

/**
 * Um passo do manual (SPEC-20261026-1910): número, título curto, 1–2 parágrafos, dica e o print. Print de celular ao
 * lado do texto a partir de `md`; print largo (TV/computador) embaixo do texto, na largura toda. No celular, tudo numa
 * coluna, sem rolagem lateral.
 */
export function ManualStepItem({ step, number, id, plan }: ManualStepItemProps) {
  const image = step.image ? MANUAL_IMAGES[step.image] : null
  const phone = image?.kind === 'phone'
  return (
    <li id={id} className="scroll-mt-4 rounded-2xl border border-border-default bg-bg-card p-4 shadow-sm sm:p-6" data-manual-step>
      <div className={cn('grid gap-5', phone && 'md:grid-cols-[minmax(0,1fr)_17rem] md:items-start md:gap-8')}>
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-blue font-bold text-white tabular-nums"
            >
              {number}
            </span>
            <div className="min-w-0 pt-1">
              <h3 className="text-lg font-extrabold leading-snug text-text-primary sm:text-xl">
                <span className="sr-only">{MANUAL_PAGE.stepLabel(number)}: </span>
                {step.title}
              </h3>
              {plan && (
                <Badge color="gold" className="mt-1.5">
                  {`${MANUAL_PAGE.planPrefix} ${plan}`}
                </Badge>
              )}
            </div>
          </div>

          <div className="mt-3 space-y-3 text-base leading-relaxed text-text-primary">
            {step.text.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>

          {step.bullets && step.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-text-primary marker:text-text-secondary">
              {step.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          {step.tip && (
            <p className="mt-4 flex gap-2 rounded-xl bg-accent-blue-soft p-3 text-sm leading-relaxed text-text-primary">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" aria-hidden="true" />
              <span>{step.tip}</span>
            </p>
          )}

          {step.see && (
            <a
              href={manualHref(step.see.slug)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-sm font-semibold text-accent-blue underline decoration-accent-blue/40 underline-offset-4 hover:decoration-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
            >
              {step.see.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>

        {image && step.imageAlt && <ManualFigure image={image} alt={step.imageAlt} />}
      </div>
    </li>
  )
}
