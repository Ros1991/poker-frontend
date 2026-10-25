import { THREE_STEPS } from '../landing.content'

/** Seção 4 — em 3 passos: criar o home game, montar a estrutura de blinds uma vez, abrir o torneio e ligar o telão. */
export function ThreeSteps() {
  return (
    <section aria-labelledby="landing-passos" className="border-y border-border-default bg-bg-secondary">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16 lg:px-8">
        <h2 id="landing-passos" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
          {THREE_STEPS.title}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {THREE_STEPS.items.map((step, index) => (
            <li key={step.title} className="flex gap-4 rounded-xl border border-border-default bg-bg-primary p-5">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-gold font-display text-lg font-black text-text-primary tabular-nums"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="text-lg font-extrabold text-text-primary">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
