import { Check } from 'lucide-react'
import { cn } from '../../utils/cn'
import type { WelcomeStep } from './welcomeFlow'

const STEPS: { key: Exclude<WelcomeStep, 'pedido'>; label: string }[] = [
  { key: 'perfil', label: 'Seus dados' },
  { key: 'plano', label: 'Seu plano' },
]

/** Indicador "1 Seus dados · 2 Seu plano" das boas-vindas (SPEC-20261023-1212). */
export function WelcomeSteps({ step }: { step: WelcomeStep }) {
  const currentIndex = step === 'pedido' ? STEPS.length : STEPS.findIndex((s) => s.key === step)

  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Etapas das boas-vindas">
      {STEPS.map((item, index) => {
        const done = index < currentIndex
        const current = index === currentIndex
        return (
          <li key={item.key} className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
            {index > 0 && <span className="h-px w-6 bg-border-default sm:w-10" aria-hidden />}
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                done && 'bg-accent-green-deep text-white',
                current && 'bg-accent-blue text-white',
                !done && !current && 'border border-border-input bg-bg-card text-text-secondary',
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
            </span>
            <span className={cn('font-semibold', current ? 'text-text-primary' : 'text-text-secondary')}>
              {item.label}
              {done && <span className="sr-only"> (concluída)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
