import { ArrowDown, CheckCircle2 } from 'lucide-react'
import { PAIN } from '../landing.content'

/** Seção 2 — a dor (antes → depois): as perguntas de toda noite e como elas se resolvem na tela. */
export function PainPoints() {
  return (
    <section aria-labelledby="landing-dor" className="border-y border-border-default bg-bg-secondary">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <h2 id="landing-dor" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
            {PAIN.title}
          </h2>
          <p className="mt-3 text-base text-text-secondary">{PAIN.text}</p>
        </div>

        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {PAIN.items.map((item) => (
            <li
              key={item.before}
              className="flex flex-col rounded-xl border border-border-default bg-bg-primary p-5"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {PAIN.beforeLabel}
              </span>
              <p className="mt-1 font-display text-lg font-extrabold text-text-primary">{item.before}</p>
              <ArrowDown className="my-3 h-5 w-5 text-text-muted" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accent-green-deep">
                {PAIN.afterLabel}
              </span>
              <p className="mt-1 flex gap-2 text-sm leading-relaxed text-text-primary">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" aria-hidden="true" />
                <span>{item.after}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
