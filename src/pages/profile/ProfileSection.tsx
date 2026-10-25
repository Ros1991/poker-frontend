import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

interface ProfileSectionProps {
  id: string
  title: string
  description?: ReactNode
  icon: LucideIcon
  children: ReactNode
  /** Zona de perigo (Excluir conta): borda vermelha */
  danger?: boolean
  /** Ação à direita do título (ex.: "Sair dos outros aparelhos") */
  action?: ReactNode
}

/** Cartão de uma seção do "Meu perfil" (SPEC-20261023-1211), com título acessível (aria-labelledby). */
export function ProfileSection({ id, title, description, icon: Icon, children, danger = false, action }: ProfileSectionProps) {
  const titleId = `${id}-titulo`
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        'rounded-xl border bg-bg-card p-4 shadow-sm sm:p-5 lg:p-6',
        danger ? 'border-accent-red/40' : 'border-border-default',
      )}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              danger ? 'bg-accent-red-soft text-accent-red-deep' : 'bg-accent-blue-soft text-accent-blue',
            )}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-text-primary">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}
