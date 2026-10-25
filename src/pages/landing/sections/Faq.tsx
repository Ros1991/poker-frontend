import { ChevronDown } from 'lucide-react'
import { FAQ } from '../landing.content'

/** Seção 6 — perguntas frequentes com `<details>` nativo (sem biblioteca, funciona sem JavaScript de estado). */
export function Faq() {
  return (
    <section aria-labelledby="landing-faq" className="border-y border-border-default bg-bg-secondary">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16 lg:px-8">
        <h2 id="landing-faq" className="text-2xl font-extrabold text-text-primary sm:text-3xl">
          {FAQ.title}
        </h2>
        <div className="mt-6 divide-y divide-border-default rounded-xl border border-border-default bg-bg-card">
          {FAQ.items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-base font-semibold text-text-primary hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-blue [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronDown
                  className="h-5 w-5 shrink-0 text-text-secondary transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
