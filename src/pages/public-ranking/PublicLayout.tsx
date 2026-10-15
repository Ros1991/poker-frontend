import type { ReactNode } from 'react'
import { Loader2, SearchX, WifiOff } from 'lucide-react'

// Moldura das páginas públicas: mesma linguagem do telão (navy profundo com
// brilho azul no topo), em coluna única pensada para o celular.
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#0a0f1c] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0d1529] via-[#0a0f1c] to-[#0a0f1c]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.14),transparent_70%)]"
      />
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
        className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-slate-400"
      >
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden="true" />
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
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
          <Icon className="h-6 w-6 text-slate-400" aria-hidden="true" />
        </span>
        <h1 className="text-balance text-xl font-semibold text-slate-100">{title}</h1>
        <p className="mt-2 max-w-xs text-balance text-sm text-slate-400">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </PublicShell>
  )
}
