import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Lista vazia das seções do home game */
export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-default bg-bg-secondary py-12 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary mb-3">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary text-center max-w-sm">
        {description}
      </p>
    </div>
  )
}

/** Carregando a lista da seção */
export function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
    </div>
  )
}
