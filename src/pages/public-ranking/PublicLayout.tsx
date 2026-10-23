import type { ReactNode } from 'react'
import { Loader2, SearchX, WifiOff } from 'lucide-react'
import { PoweredByBadge } from '../../components/plan'
import type { PublicRanking } from '../../types/publicRanking.types'
import { resolveMediaUrl } from '../../utils/mediaUrl'

/** Plano do dono que o ranking público carrega (SPEC-20261023-1205, D6) */
export type PublicBranding = Pick<PublicRanking, 'plan' | 'showBadge' | 'clubLogoUrl'>

/**
 * Selo do rodapé, pela mesma regra do telão: Mesa = selo + QR do site; Clube = selo discreto;
 * Liga (sem selo) = nada aqui, a logo do clube vai no cabeçalho da página.
 */
function PublicBrandFooter({ branding }: { branding: PublicBranding }) {
  if (!branding.showBadge) return null
  return (
    <footer className="mt-8 flex justify-center">
      <PoweredByBadge variant={branding.plan === 'Mesa' ? 'qr' : 'discreta'} />
    </footer>
  )
}

// Moldura das páginas públicas: mesma paleta clara do telão (fundo da página, cards brancos
// com borda), em coluna única pensada para o celular. Sem degradês: a cor vem só dos tokens.
// Com `branding` (resposta do ranking), o rodapé leva o selo "Feito com Poker da Galera".
export function PublicShell({
  children,
  branding,
}: {
  children: ReactNode
  branding?: PublicBranding
}) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-bg-primary text-text-primary">
      <main className="relative mx-auto w-full max-w-lg px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        {children}
        {branding && <PublicBrandFooter branding={branding} />}
      </main>
    </div>
  )
}

/** Logo do clube no cabeçalho (só Liga: `clubLogoUrl` vem só quando o selo some) */
export function PublicClubLogo({
  branding,
  alt,
  className,
}: {
  branding: PublicBranding
  alt: string
  className?: string
}) {
  const src = !branding.showBadge ? resolveMediaUrl(branding.clubLogoUrl) : null
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      className={className ?? 'h-12 w-12 shrink-0 rounded-xl border border-border-default bg-bg-card object-contain p-1'}
    />
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
