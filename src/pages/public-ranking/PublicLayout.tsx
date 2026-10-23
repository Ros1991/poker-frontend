import type { ReactNode } from 'react'
import { Loader2, SearchX, WifiOff } from 'lucide-react'

// Moldura das páginas públicas: mesma paleta clara do telão (fundo da página, cards brancos
// com borda), em coluna única pensada para o celular. Sem degradês: a cor vem só dos tokens.
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg-primary text-text-primary">
      <main className="relative mx-auto w-full max-w-lg px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        {children}
      </main>
    </div>
  )
}

export function PublicLoading() {
  return (
    <PublicShell>
      <div
        role="status"
        className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-text-secondary"
      >
        <Loader2 className="h-8 w-8 animate-spin text-accent-blue" aria-hidden="true" />
        <p className="text-sm">Carregando ranking…</p>
      </div>
    </PublicShell>
  )
}

interface PublicMessageProps {
  variant: 'not-found' | 'error'
  title: string
  description: string
  action?: ReactNode
}

export function PublicMessage({ variant, title, description, action }: PublicMessageProps) {
  const Icon = variant === 'not-found' ? SearchX : WifiOff
  return (
    <PublicShell>
      <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-bg-tertiary">
          <Icon className="h-6 w-6 text-text-secondary" aria-hidden="true" />
        </span>
        <h1 className="text-balance text-xl font-semibold text-text-primary">{title}</h1>
        <p className="mt-2 max-w-xs text-balance text-sm text-text-secondary">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </PublicShell>
  )
}
