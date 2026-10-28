import type { ReactNode } from 'react'

interface AiSectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
}

/** Bloco da tela de IA: cartão com título (h2) e descrição curta */
export function AiSection({ id, title, description, children }: AiSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-card p-4 shadow-sm sm:p-6">
      <div>
        <h2 id={`${id}-titulo`} className="text-lg font-semibold text-text-primary">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  )
}
